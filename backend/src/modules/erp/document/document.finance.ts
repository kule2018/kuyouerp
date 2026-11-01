import { BadRequestException } from '@nestjs/common';
import { DocumentConfig } from './document.config';
import { TABLE_META } from '../../../table-meta';

/** 统一 SQL 执行签名（与 document.service.ts 的 Runner 一致，事务内外通用） */
type Runner = (sql: string, params?: any[]) => Promise<any>;

/** 销货明细 → 销货汇总 复制列（与源 GoodsSales::examine 一致：复制明细行，排除自增 id） */
const SALES_SUM_COLS = [
  'admin_id', 'purchase_code', 'purchase_type', 'purchase_time', 'delivery_time', 'customers_id',
  'receiving_address', 'sale_user', 'goods_code', 'goods_note', 'goods_attr', 'goods_unit', 'stores_id',
  'allow_stock', 'number', 'default_unit', 'basic_nmber', 'unit_price', 'cost_price', 'tax_included',
  'discount', 'dis_money', 'all_money', 'tax_rate', 'tax_money', 'money_tax_price', 'remark',
  'purchase_order_id', 'sales_order_id', 'returns_order_id', 'preferential_rate', 'preferential_money',
  'real_money', 'purchase_money', 'customers_money', 'preparation_id', 'examine_id', 'operation_id',
  'pay_status', 'check_status', 'examine_status', 'examine_time', 'pay_money', 'account', 'print_num',
  'order_info_id', 'batch_id', 'batch_name', 'manufacture', 'guarantee', 'validity', 'period',
  'createtime', 'updatetime',
].map((c) => `\`${c}\``).join(',');

/** 购货明细 → 购货汇总 复制列（与源 GoodsPurchase::examine 一致） */
const PURCHASE_SUM_COLS = [
  'admin_id', 'purchase_code', 'purchase_type', 'purchase_time', 'delivery_time', 'supplyer_code',
  'goods_code', 'goods_note', 'goods_attr', 'goods_unit', 'stores_id', 'allow_stock', 'number',
  'default_unit', 'basic_nmber', 'unit_price', 'tax_included', 'discount', 'dis_money', 'all_money',
  'tax_rate', 'tax_money', 'money_tax_price', 'remark', 'purchase_order_id', 'sales_order_id',
  'returns_order_id', 'preferential_rate', 'preferential_money', 'real_money', 'purchase_money',
  'preparation_id', 'examine_id', 'operation_id', 'pay_status', 'check_status', 'examine_status',
  'examine_time', 'pay_money', 'account', 'print_num', 'order_info_id', 'batch_id', 'batch_name',
  'manufacture', 'guarantee', 'validity', 'period', 'createtime', 'updatetime',
].map((c) => `\`${c}\``).join(',');

/**
 * 单据审核财务联动服务
 *
 * 原系统每类业务单据的 examine 方法除翻转审核位外，还各自维护一组资金数据，
 * 本服务按 document.config.ts 的 finance 档案逐一对应还原：
 *
 *  purchase       购货单     ：供应商应付款 +、付款账户支出、账户流水(2)、付款流水、采购开票登记
 *  purchaseRetreat购货退货单 ：供应商应付款 +、退款账户收入、账户流水(4)、付款流水(退货)、开票登记
 *  sales          销货单     ：客户应收款 +、收款账户收入、账户流水(5)、销售流水、销售开票登记
 *  salesRetreat   销货退货单 ：客户应收款 +、退款账户支出、账户流水(6)、销售流水(退货)、开票登记
 *  collection     收款单     ：收款子表账户收入、账户流水(7)、核销源单、客户对账明细
 *  payment        付款单     ：付款子表账户支出、账户流水(8)、核销源单、供应商对账明细
 *  income         其他收入单 ：账户收入、账户流水(9)、关联采购销售费用、应收明细
 *  expenditure    其他支出单 ：账户支出、账户流水(10)、关联采购销售费用
 *  transfer       转账单     ：转出账户支出(流水12)、转入账户收入(流水11)
 *  writeoff       核销单     ：源单收付状态推进、核销来源流水
 *
 * 反审核（state=0）按源单逻辑整体冲回：删除本次审核写入的流水 / 登记行，
 * 账户余额与往来欠款按反方向加减。所有表名均为硬编码白名单，取值一律参数化。
 */
export class DocumentFinanceService {
  /** 数字规整：null / undefined / '' 一律按 0 处理 */
  private num(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /** 保留小数（与源系统 round 一致，默认 4 位） */
  private round(v: number, p = 4): number {
    const f = 10 ** p;
    return Math.round(v * f) / f;
  }

  /**
   * 结账期间校验（对应源 library/Checkout::checkOutTime）
   * 规则：取最近一次结账时间，单据时间早于或等于结账时间的一律不可操作。
   * @param run  SQL 执行器（事务内）
   * @param time 单据时间（秒级时间戳或日期字符串）
   * @returns 通过返回 true；否则返回错误消息（由调用方抛出）
   */
  async checkOutTime(run: Runner, time: any): Promise<true | string> {
    const rows = await run(
      'SELECT `checktime`, `checkdate` FROM `kuyou_checkout` ORDER BY `checktime` DESC LIMIT 1',
    );
    if (!rows.length) return true;
    const checktime = this.num(rows[0].checktime);
    const checkdate = rows[0].checkdate || '';
    let t = time;
    if (typeof t === 'string') {
      // 兼容 'YYYY-MM-DD HH:mm:ss' / 'YYYY-MM-DD' / 时间戳字符串
      t = /^\d+$/.test(t) ? Number(t) : Math.floor(Date.parse(t.replace(' ', 'T')) / 1000);
    }
    t = this.num(t);
    if (!t) return true;
    if (t <= checktime) return `不可操作小于结账日期${checkdate}的数据`;
    return true;
  }

  /**
   * 审核 / 反审核财务联动入口
   * @param run     SQL 执行器（事务内）
   * @param c       单据配置
   * @param doc     主表当前行（审核前读出的完整行）
   * @param state   1=审核 0=反审核
   * @param adminId 操作人ID
   */
  async post(run: Runner, c: DocumentConfig, doc: any, state: 0 | 1, adminId: any): Promise<void> {
    switch (c.finance) {
      case 'purchase': return this.purchaseLike(run, doc, state, 'purchase');
      case 'purchaseRetreat': return this.purchaseLike(run, doc, state, 'purchaseRetreat');
      case 'sales': return this.salesLike(run, doc, state, 'sales', adminId);
      case 'salesRetreat': return this.salesLike(run, doc, state, 'salesRetreat', adminId);
      case 'collection': return this.collection(run, doc, state, adminId);
      case 'payment': return this.payment(run, doc, state, adminId);
      case 'income': return this.income(run, doc, state);
      case 'expenditure': return this.expenditure(run, doc, state);
      case 'transfer': return this.transfer(run, doc, state);
      case 'writeoff': return this.writeoff(run, doc, state);
      default: return; // 无财务档案的单据仅翻状态位 + 库存联动
    }
  }

  /* ==================== 购销类（购货 / 购货退货 / 销货 / 销货退货） ==================== */

  /**
   * 购销类审核财务联动（对应源 GoodsPurchase / GoodsExchange / GoodsSales / GoodsSalesExchange::examine）
   * 整体思路：先按单据欠款加减往来单位余额，再按收付款额增减结算账户并落账户流水，
   * 最后写入收付款流水与开票登记；反审核则反向冲回并删除本次写入的流水 / 登记行。
   */
  private async purchaseLike(run: Runner, doc: any, state: 0 | 1, kind: 'purchase' | 'purchaseRetreat') {
    const code = doc.purchase_code;
    const sign = state === 1 ? 1 : -1;
    const retreat = kind === 'purchaseRetreat';

    // 1) 往来欠款：购货/退货均按 arrears 加供应商应付款（反审核冲回）
    const arrears = this.num(doc.arrears);
    if (arrears !== 0 && doc.supplyer_code) {
      await run('UPDATE `kuyou_suppliers` SET `need_give_account` = `need_give_account` + ? WHERE `supplyer_code` = ?', [
        this.round(sign * arrears),
        doc.supplyer_code,
      ]);
    }

    // 2) 结算账户：购货按 pay_money 支出；退货按 retreat_money 退款收入
    const money = retreat ? this.num(doc.retreat_money) : this.num(doc.pay_money);
    const accountId = doc.account;
    if (money > 0 && accountId) {
      const acc = (
        await run('SELECT `id`, `account_coding`, `account_name`, `balance` FROM `kuyou_accounts` WHERE `id` = ?', [accountId])
      )[0];
      if (acc) {
        // 购货支出(-)，退货收入(+)；反审核按反方向冲回
        const amount = this.round(money);
        if (retreat) {
          await run(state === 1 ? 'UPDATE `kuyou_accounts` SET `balance` = `balance` + ? WHERE `id` = ?' : 'UPDATE `kuyou_accounts` SET `balance` = `balance` - ? WHERE `id` = ?', [amount, acc.id]);
        } else {
          await run(state === 1 ? 'UPDATE `kuyou_accounts` SET `balance` = `balance` - ? WHERE `id` = ?' : 'UPDATE `kuyou_accounts` SET `balance` = `balance` + ? WHERE `id` = ?', [amount, acc.id]);
        }
        if (state === 1) {
          await run(
            'INSERT INTO `kuyou_accounts_log` (`account_coding`, `account_name`, `balance`, `income`, `expenditure`, `pay_time`, `bill_code`, `business_type`, `supplyer_code`, `remark`, `createtime`, `updatetime`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              acc.account_coding,
              acc.account_name,
              // 源系统流水余额列记为「原余额 - 发生额」（与其账户更新方向各自独立，此处保持一致）
              this.round(this.num(acc.balance) - money),
              retreat ? this.round(money) : null,
              retreat ? null : this.round(money),
              doc.purchase_time,
              code,
              retreat ? 4 : 2,
              doc.supplyer_code,
              doc.note ?? null,
              this.now(),
              this.now(),
            ],
          );
        } else {
          await run('DELETE FROM `kuyou_accounts_log` WHERE `bill_code` = ? AND `business_type` = ?', [code, retreat ? 4 : 2]);
        }
      }
    }

    // 3) 收付款流水 + 开票登记
    if (state === 1) {
      await run(
        'INSERT INTO `kuyou_payment_log` (`suppliers_code`, `business_type`, `bill_time`, `bill_code`, `bill_codes`, `purchase_money`, `money_tax_price`, `discount_money`, `real_money`, `pay_money`, `give_money`, `reamrk`, `createtime`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          doc.supplyer_code,
          retreat ? 2 : 1,
          doc.purchase_time,
          code,
          code,
          this.round(retreat ? -this.num(doc.all_money) : this.num(doc.all_money)),
          this.round(retreat ? -this.num(doc.all_money) + this.num(doc.preferential_money) : this.num(doc.all_money) - this.num(doc.preferential_money)),
          this.round(this.num(doc.preferential_money)),
          this.round(retreat ? -this.num(doc.real_money) : this.num(doc.real_money)),
          this.round(retreat ? -this.num(doc.retreat_money) : this.num(doc.pay_money)),
          this.round(retreat ? -arrears : arrears),
          doc.note ?? null,
          this.now(),
        ],
      );
      await run(
        'INSERT INTO `kuyou_invoicing` (`suppliers_code`, `status`, `bill_time`, `bill_code`, `bill_codes`, `money`, `tax`, `real_money`, `pay_money`, `give_money`, `createtime`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          doc.supplyer_code,
          retreat ? this.num(doc.retreat_status) + 3 : doc.pay_status,
          doc.purchase_time,
          code,
          code,
          this.round(this.num(doc.real_money) - this.num(doc.tax_money)),
          this.round(this.num(doc.tax_money)),
          this.round(this.num(doc.real_money)),
          0,
          this.round(this.num(doc.real_money)),
          this.now(),
        ],
      );

      // 应付账款明细（与源 GoodsPurchase::examine 一致：arrears>0 时写 kuyou_accounts_copewith，business_type=6）
      if (kind === 'purchase' && this.num(doc.arrears) > 0 && doc.supplyer_code) {
        const supId = (await run('SELECT `id` FROM `kuyou_suppliers` WHERE `supplyer_code` = ?', [doc.supplyer_code]))[0]?.id;
        if (supId) {
          await run(
            'INSERT INTO `kuyou_accounts_copewith` (`suppliers_id`, `purchase_time`, `purchase_code`, `business_type`, `receivable`, `remark`, `sale_money`, `receivable_money`, `amount`, `cost`, `real_money`, `createtime`, `updatetime`) VALUES (?, ?, ?, 6, ?, ?, ?, ?, ?, NULL, ?, ?, ?)',
            [
              supId,
              doc.purchase_time,
              code,
              this.round(this.num(doc.arrears)),
              doc.note ?? null,
              this.round(this.num(doc.real_money) + this.num(doc.preferential_money)),
              this.round(this.num(doc.real_money)),
              this.round(this.num(doc.preferential_money)),
              this.round(this.num(doc.pay_money)),
              this.now(),
              this.now(),
            ],
          );
        }
      }

      // 采购汇总表回填（源 GoodsPurchase::examine：复制明细行 → kuyou_goods_purchase_summary）
      await run(
        `INSERT INTO \`kuyou_goods_purchase_summary\` (${PURCHASE_SUM_COLS}) SELECT ${PURCHASE_SUM_COLS} FROM \`kuyou_goods_purchase_info\` WHERE \`purchase_code\` = ?`,
        [code],
      );

    } else {
      await run('DELETE FROM `kuyou_payment_log` WHERE `bill_codes` = ?', [code]);
      await run('DELETE FROM `kuyou_invoicing` WHERE `bill_codes` = ?', [code]);
      await run('DELETE FROM `kuyou_writeoff_source` WHERE `purchase_code` = ? AND `purchase_type` = ? AND `type` = 1', [code, retreat ? 4 : 1]);
      await run('DELETE FROM `kuyou_cost` WHERE `business_type` = ? AND `purchase_number` = ?', [retreat ? 1 : 1, code]);
      await run('DELETE FROM `kuyou_accounts_copewith` WHERE `business_type` = 6 AND `purchase_code` = ?', [code]);
      await run('DELETE FROM `kuyou_goods_purchase_summary` WHERE `purchase_code` = ?', [code]);
    }
  }

  /**
   * 销货类审核财务联动（对应源 GoodsSales / GoodsSalesExchange::examine）
   * 与购销镜像：客户应收款、收款账户收入（退货为退款支出）、销售流水、销售开票登记。
   */
  private async salesLike(run: Runner, doc: any, state: 0 | 1, kind: 'sales' | 'salesRetreat', adminId?: any) {
    const code = doc.purchase_code;
    const sign = state === 1 ? 1 : -1;
    const retreat = kind === 'salesRetreat';

    // 1) 客户应收款
    const arrears = this.num(doc.arrears);
    if (arrears !== 0 && doc.customers_id) {
      await run('UPDATE `kuyou_customers` SET `need_receive_account` = `need_receive_account` + ? WHERE `id` = ?', [
        this.round(sign * arrears),
        doc.customers_id,
      ]);
    }

    // 2) 结算账户：销货按 pay_money 收款收入；退货按 retreat_money 退款支出
    const money = retreat ? this.num(doc.retreat_money) : this.num(doc.pay_money);
    const accountId = doc.account;
    if (money > 0 && accountId) {
      const acc = (
        await run('SELECT `id`, `account_coding`, `account_name`, `balance` FROM `kuyou_accounts` WHERE `id` = ?', [accountId])
      )[0];
      if (acc) {
        // 销货收入(+)，退货支出(-)；反审核按反方向冲回
        const amount = this.round(money);
        if (retreat) {
          await run(state === 1 ? 'UPDATE `kuyou_accounts` SET `balance` = `balance` - ? WHERE `id` = ?' : 'UPDATE `kuyou_accounts` SET `balance` = `balance` + ? WHERE `id` = ?', [amount, acc.id]);
        } else {
          await run(state === 1 ? 'UPDATE `kuyou_accounts` SET `balance` = `balance` + ? WHERE `id` = ?' : 'UPDATE `kuyou_accounts` SET `balance` = `balance` - ? WHERE `id` = ?', [amount, acc.id]);
        }
        if (state === 1) {
          await run(
            'INSERT INTO `kuyou_accounts_log` (`account_coding`, `account_name`, `balance`, `income`, `expenditure`, `pay_time`, `bill_code`, `business_type`, `customers_id`, `remark`, `createtime`, `updatetime`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              acc.account_coding,
              acc.account_name,
              // 源系统流水余额列记为「原余额 - 发生额」（与销货收货入账方向各自独立，保持一致）
              this.round(this.num(acc.balance) - money),
              retreat ? null : this.round(money),
              retreat ? this.round(money) : null,
              doc.purchase_time,
              code,
              retreat ? 6 : 5,
              doc.customers_id,
              doc.note ?? null,
              this.now(),
              this.now(),
            ],
          );
        } else {
          await run('DELETE FROM `kuyou_accounts_log` WHERE `bill_code` = ? AND `business_type` = ?', [code, retreat ? 6 : 5]);
        }
      }
    }

    // 3) 销售流水 + 销售开票登记
    if (state === 1) {
      await run(
        'INSERT INTO `kuyou_sales_payment_log` (`customers_id`, `sale_user`, `business_type`, `bill_time`, `bill_code`, `bill_codes`, `purchase_money`, `discount_money`, `real_money`, `money_tax_price`, `pay_money`, `give_money`, `reamrk`, `createtime`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          doc.customers_id,
          doc.sale_user ?? null,
          retreat ? 2 : 1,
          doc.purchase_time,
          code,
          code,
          this.round(retreat ? -this.num(doc.all_money) : this.num(doc.all_money)),
          this.round(this.num(doc.preferential_money)),
          this.round(retreat ? -this.num(doc.real_money) : this.num(doc.real_money)),
          this.round(this.num(doc.money_tax_price)),
          this.round(retreat ? -this.num(doc.retreat_money) : this.num(doc.pay_money)),
          this.round(retreat ? -arrears : arrears),
          doc.note ?? null,
          this.now(),
        ],
      );
      await run(
        'INSERT INTO `kuyou_sales_invoicing` (`customers_id`, `status`, `bill_time`, `bill_code`, `bill_codes`, `money`, `tax`, `real_money`, `pay_money`, `give_money`, `createtime`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          doc.customers_id,
          retreat ? this.num(doc.retreat_status) + 3 : doc.pay_status,
          doc.purchase_time,
          code,
          code,
          this.round(this.num(doc.real_money) - this.num(doc.tax_money)),
          this.round(this.num(doc.tax_money)),
          this.round(this.num(doc.real_money)),
          0,
          this.round(this.num(doc.real_money)),
          this.now(),
        ],
      );

      // 应收账款明细（与源 GoodsSales::examine 一致：arrears>0 时写 kuyou_accounts_receivable，business_type=6）
      if (kind === 'sales' && this.num(doc.arrears) > 0 && doc.customers_id) {
        await run(
          'INSERT INTO `kuyou_accounts_receivable` (`customers_id`, `purchase_time`, `purchase_code`, `business_type`, `receivable`, `staff_member_id`, `remark`, `sale_money`, `receivable_money`, `amount`, `cost`, `real_money`, `createtime`, `updatetime`) VALUES (?, ?, ?, 6, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            doc.customers_id,
            doc.purchase_time,
            code,
            this.round(this.num(doc.arrears)),
            doc.sale_user ?? null,
            doc.note ?? null,
            this.round(this.num(doc.money_tax_price)),
            this.round(this.num(doc.real_money)),
            this.round(this.num(doc.preferential_money)),
            0,
            this.round(this.num(doc.pay_money)),
            this.now(),
            this.now(),
          ],
        );
      }

      // 销售汇总表回填（源 GoodsSales::examine：复制明细行 → kuyou_goods_sales_summary）
      await run(
        `INSERT INTO \`kuyou_goods_sales_summary\` (${SALES_SUM_COLS}) SELECT ${SALES_SUM_COLS} FROM \`kuyou_goods_sales_info\` WHERE \`purchase_code\` = ?`,
        [code],
      );
      // 销售利润表回填（源 GoodsSales::examine：每单头一行；成本由结账 special.Checkout 回填 sales_cost）
      const disSum = (await run('SELECT SUM(`dis_money`) AS s FROM `kuyou_goods_sales_info` WHERE `purchase_code` = ?', [code]))[0]?.s;
      await run(
        `INSERT INTO \`kuyou_goods_sales_profit\` (\`purchase_type\`,\`purchase_code\`,\`purchase_time\`,\`customers_id\`,\`sale_user\`,\`preparation_id\`,\`examine_id\`,\`number\`,\`amount\`,\`all_money\`,\`tax_money\`,\`money_tax_price\`,\`preferential_money\`,\`purchase_money\`,\`real_money\`,\`customers_money\`,\`need_money\`,\`pay_money\`,\`remark\`,\`admin_id\`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          retreat ? 2 : 1,
          code,
          doc.purchase_time,
          doc.customers_id ?? null,
          doc.sale_user ?? null,
          doc.preparation_id ?? null,
          adminId ?? null,
          this.num(doc.number),
          this.num(disSum) > 0 ? this.round(this.num(disSum)) : null,
          doc.all_money,
          this.num(doc.tax_money),
          this.num(doc.money_tax_price),
          this.num(doc.preferential_money),
          this.num(doc.purchase_money),
          this.num(doc.real_money),
          this.num(doc.customers_money),
          this.round(this.num(doc.real_money) + this.num(doc.customers_money)),
          this.num(doc.pay_money),
          doc.note ?? null,
          adminId ?? null,
        ],
      );

    } else {
      await run('DELETE FROM `kuyou_writeoff_source` WHERE `purchase_code` = ? AND `purchase_type` = ? AND `type` = 1', [code, retreat ? 3 : 3]);
      await run('DELETE FROM `kuyou_cost` WHERE `business_type` = 2 AND `purchase_number` = ?', [code]);
      await run('DELETE FROM `kuyou_accounts_receivable` WHERE `business_type` = 6 AND `purchase_code` = ?', [code]);
      await run('DELETE FROM `kuyou_goods_sales_summary` WHERE `purchase_code` = ?', [code]);
      await run('DELETE FROM `kuyou_goods_sales_profit` WHERE `purchase_code` = ?', [code]);
    }
  }

  /* ==================== 收款单 ==================== */

  /**
   * 收款单审核财务联动（对应源 Collection::examine）
   * 1) 按收款子表逐账户入账（余额+、账户流水 business_type=7）
   * 2) 预收单登记核销来源（writeoff_source）
   * 3) 无核销明细时记客户对账明细（advance）；有核销明细时记应收冲减（receivable=-write_off）
   * 4) 逐条核销明细推进源单（销货/销货退货）的已收与收款状态，并落销售流水
   */
  private async collection(run: Runner, doc: any, state: 0 | 1, adminId: any) {
    const code = doc.purchase_code;
    const now = this.now();

    if (state === 1) {
      // 1) 收款子表账户入账
      const accounts = await run('SELECT * FROM `kuyou_collection_account` WHERE `collection_id` = ?', [doc.id]);
      for (const a of accounts) {
        const acc = (await run('SELECT `id`, `account_coding`, `account_name`, `balance` FROM `kuyou_accounts` WHERE `id` = ?', [a.accounts_id]))[0];
        if (!acc) continue;
        await run('UPDATE `kuyou_accounts` SET `balance` = `balance` + ? WHERE `id` = ?', [this.round(this.num(a.money)), acc.id]);
        await run(
          'INSERT INTO `kuyou_accounts_log` (`account_coding`, `account_name`, `balance`, `income`, `pay_time`, `bill_code`, `business_type`, `customers_id`, `payment`, `remark`, `createtime`, `updatetime`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            acc.account_coding,
            acc.account_name,
            this.round(this.num(acc.balance) + this.num(a.money)),
            this.round(this.num(a.money)),
            doc.purchase_time,
            a.purchase_code || code,
            7,
            doc.customers_id,
            doc.staff_member_id ?? null,
            doc.remarks ?? null,
            now,
            now,
          ],
        );
      }

      // 2) 预收单登记核销来源
      if (this.num(doc.business_type) === 1) {
        await run(
          'INSERT INTO `kuyou_writeoff_source` (`purchase_type`, `type`, `customers_id`, `purchase_code`, `purchase_time`, `price`, `money`, `write_off`, `remark`) VALUES (1, 1, ?, ?, ?, ?, 0, ?, ?)',
          [doc.customers_id, code, doc.purchase_time, this.round(this.num(doc.advance)), doc.remarks ?? null],
        );
      }

      // 3) 客户对账明细
      const infoList = await run('SELECT * FROM `kuyou_collection_sale` WHERE `collection_id` = ?', [doc.id]);
      if (doc.customers_id) {
        if (!infoList.length) {
          await run(
            'INSERT INTO `kuyou_accounts_receivable` (`customers_id`, `purchase_time`, `purchase_code`, `business_type`, `advance`, `real_money`, `remark`, `createtime`, `updatetime`) VALUES (?, ?, ?, 9, ?, ?, ?, ?, ?)',
            [doc.customers_id, doc.purchase_time, code, this.round(this.num(doc.write_off)), this.round(this.num(doc.money)), doc.remarks ?? null, now, now],
          );
        } else {
          await run(
            'INSERT INTO `kuyou_accounts_receivable` (`customers_id`, `purchase_time`, `purchase_code`, `business_type`, `receivable`, `real_money`, `remark`, `createtime`, `updatetime`) VALUES (?, ?, ?, 9, ?, ?, ?, ?, ?)',
            [doc.customers_id, doc.purchase_time, code, this.round(-this.num(doc.write_off)), this.round(this.num(doc.money)), doc.remarks ?? null, now, now],
          );
        }
      }

      // 4) 逐条核销明细推进源单
      for (const info of infoList) {
        await this.writeoffSale(run, info, doc, now);
      }
    } else {
      // 反审核：删除本次写入的流水与对账明细，账户余额冲回
      const accounts = await run('SELECT * FROM `kuyou_collection_account` WHERE `collection_id` = ?', [doc.id]);
      for (const a of accounts) {
        await run('UPDATE `kuyou_accounts` SET `balance` = `balance` - ? WHERE `id` = ?', [this.round(this.num(a.money)), a.accounts_id]);
      }
      await run('DELETE FROM `kuyou_accounts_log` WHERE `bill_code` IN (SELECT `purchase_code` FROM `kuyou_collection_account` WHERE `collection_id` = ?) AND `business_type` = 7', [doc.id]);
      await run('DELETE FROM `kuyou_accounts_receivable` WHERE `purchase_code` = ? AND `business_type` = 9', [code]);
      await run('DELETE FROM `kuyou_writeoff_source` WHERE `purchase_code` = ? AND `purchase_type` = 1 AND `type` = 1', [code]);
      await run('DELETE FROM `kuyou_sales_payment_log` WHERE `bill_codes` = ?', [code]);
    }
  }

  /* ==================== 付款单 ==================== */

  /**
   * 付款单审核财务联动（对应源 Payment::examine）
   * 与收款单镜像：子表账户支出（流水 business_type=8）、预付单登记核销来源、
   * 供应商对账明细（accounts_copewith）、逐条核销明细推进源单（购货/购货退货）。
   */
  private async payment(run: Runner, doc: any, state: 0 | 1, adminId: any) {
    const code = doc.purchase_code;
    const now = this.now();

    if (state === 1) {
      // 1) 付款子表账户支出
      const accounts = await run('SELECT * FROM `kuyou_payment_account` WHERE `collection_id` = ?', [doc.id]);
      for (const a of accounts) {
        const acc = (await run('SELECT `id`, `account_coding`, `account_name`, `balance` FROM `kuyou_accounts` WHERE `id` = ?', [a.accounts_id]))[0];
        if (!acc) continue;
        await run('UPDATE `kuyou_accounts` SET `balance` = `balance` - ? WHERE `id` = ?', [this.round(this.num(a.money)), acc.id]);
        await run(
          'INSERT INTO `kuyou_accounts_log` (`account_coding`, `account_name`, `balance`, `expenditure`, `pay_time`, `bill_code`, `business_type`, `payment`, `remark`, `createtime`, `updatetime`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            acc.account_coding,
            acc.account_name,
            this.round(this.num(acc.balance) + this.num(a.money)),
            this.round(this.num(a.money)),
            doc.purchase_time,
            a.purchase_code || code,
            8,
            doc.staff_member_id ?? null,
            doc.remarks ?? null,
            now,
            now,
          ],
        );
      }

      // 2) 预付单登记核销来源
      if (this.num(doc.business_type) === 1) {
        await run(
          'INSERT INTO `kuyou_writeoff_source` (`purchase_type`, `type`, `suppliers_code`, `purchase_code`, `purchase_time`, `price`, `money`, `write_off`, `remark`) VALUES (2, 1, ?, ?, ?, ?, 0, ?, ?)',
          [doc.customers_id, code, doc.purchase_time, this.round(this.num(doc.advance)), doc.remarks ?? null],
        );
      }

      // 3) 供应商对账明细
      const infoList = await run('SELECT * FROM `kuyou_payment_sale` WHERE `collection_id` = ?', [doc.id]);
      if (doc.customers_id) {
        if (!infoList.length) {
          await run(
            'INSERT INTO `kuyou_accounts_copewith` (`suppliers_id`, `purchase_time`, `purchase_code`, `business_type`, `advance`, `real_money`, `remark`, `createtime`, `updatetime`) VALUES (?, ?, ?, 9, ?, ?, ?, ?, ?)',
            [doc.customers_id, doc.purchase_time, code, this.round(this.num(doc.advance)), this.round(this.num(doc.money)), doc.remarks ?? null, now, now],
          );
        } else {
          await run(
            'INSERT INTO `kuyou_accounts_copewith` (`suppliers_id`, `purchase_time`, `purchase_code`, `business_type`, `receivable`, `real_money`, `remark`, `createtime`, `updatetime`) VALUES (?, ?, ?, 9, ?, ?, ?, ?, ?)',
            [doc.customers_id, doc.purchase_time, code, this.round(-this.num(doc.write_off)), this.round(this.num(doc.money)), doc.remarks ?? null, now, now],
          );
        }
      }

      // 4) 逐条核销明细推进源单
      for (const info of infoList) {
        await this.writeoffPurchase(run, info, doc, now);
      }
    } else {
      const accounts = await run('SELECT * FROM `kuyou_payment_account` WHERE `collection_id` = ?', [doc.id]);
      for (const a of accounts) {
        await run('UPDATE `kuyou_accounts` SET `balance` = `balance` + ? WHERE `id` = ?', [this.round(this.num(a.money)), a.accounts_id]);
      }
      await run('DELETE FROM `kuyou_accounts_log` WHERE `bill_code` IN (SELECT `purchase_code` FROM `kuyou_payment_account` WHERE `collection_id` = ?) AND `business_type` = 8', [doc.id]);
      await run('DELETE FROM `kuyou_accounts_copewith` WHERE `purchase_code` = ? AND `business_type` = 9', [code]);
      await run('DELETE FROM `kuyou_writeoff_source` WHERE `purchase_code` = ? AND `purchase_type` = 2 AND `type` = 1', [code]);
      await run('DELETE FROM `kuyou_payment_log` WHERE `bill_codes` = ?', [code]);
    }
  }

  /* ==================== 其他收入单 ==================== */

  /**
   * 其他收入单审核财务联动（对应源 Income::examine）
   * 账户收入入账（流水 9）、关联采购销售费用冲减（cost.pay_money -= pay_money）、
   * 部分收款时记应收明细（business_type=8）。
   */
  private async income(run: Runner, doc: any, state: 0 | 1) {
    const code = doc.purchase_code;
    const now = this.now();
    const payMoney = this.num(doc.pay_money);

    if (state === 1) {
      // 关联采购销售费用
      if (doc.cost_id) {
        const cost = (await run('SELECT `id`, `pay_money` FROM `kuyou_cost` WHERE `id` = ?', [doc.cost_id]))[0];
        if (!cost) throw new BadRequestException(`编号${code}审核失败，关联的采购销售费用数据错误`);
        await run('UPDATE `kuyou_cost` SET `pay_money` = `pay_money` - ? WHERE `id` = ?', [this.round(payMoney), cost.id]);
      }
      // 账户收入
      if (doc.accounts_id) {
        const acc = (await run('SELECT `id`, `account_coding`, `account_name`, `balance` FROM `kuyou_accounts` WHERE `id` = ?', [doc.accounts_id]))[0];
        if (acc) {
          await run('UPDATE `kuyou_accounts` SET `balance` = `balance` + ? WHERE `id` = ?', [this.round(payMoney), acc.id]);
          await run(
            'INSERT INTO `kuyou_accounts_log` (`account_coding`, `account_name`, `balance`, `income`, `pay_time`, `bill_code`, `business_type`, `customers_id`, `remark`, `createtime`, `updatetime`) VALUES (?, ?, ?, ?, ?, ?, 9, ?, ?, ?, ?)',
            [
              acc.account_coding,
              acc.account_name,
              this.round(this.num(acc.balance) + payMoney),
              this.round(payMoney),
              doc.purchase_time,
              code,
              doc.customers_id,
              doc.remark ?? null,
              now,
              now,
            ],
          );
        }
      }
      // 部分收款记应收明细
      if (payMoney < this.num(doc.money) && doc.customers_id) {
        await run(
          'INSERT INTO `kuyou_accounts_receivable` (`customers_id`, `purchase_time`, `purchase_code`, `business_type`, `receivable`, `sale_money`, `receivable_money`, `real_money`, `remark`, `createtime`, `updatetime`) VALUES (?, ?, ?, 8, ?, ?, ?, ?, ?, ?, ?)',
          [
            doc.customers_id,
            doc.purchase_time,
            code,
            this.round(this.num(doc.arrears)),
            this.round(this.num(doc.money)),
            this.round(this.num(doc.money)),
            this.round(payMoney),
            doc.remark ?? null,
            now,
            now,
          ],
        );
      }
    } else {
      if (doc.cost_id) {
        await run('UPDATE `kuyou_cost` SET `pay_money` = `pay_money` + ? WHERE `id` = ?', [this.round(payMoney), doc.cost_id]);
      }
      if (doc.accounts_id) {
        await run('UPDATE `kuyou_accounts` SET `balance` = `balance` - ? WHERE `id` = ?', [this.round(payMoney), doc.accounts_id]);
      }
      await run('DELETE FROM `kuyou_accounts_receivable` WHERE `business_type` = 8 AND `purchase_code` = ?', [code]);
      await run('DELETE FROM `kuyou_accounts_log` WHERE `business_type` = 9 AND `bill_code` = ?', [code]);
    }
  }

  /* ==================== 其他支出单 ==================== */

  /**
   * 其他支出单审核财务联动（对应源 Expenditure::examine）
   * 账户支出入账（流水 10）、按支出明细逐条冲减关联采购销售费用（含部分付款状态推进）。
   */
  private async expenditure(run: Runner, doc: any, state: 0 | 1) {
    const code = doc.purchase_code;
    const now = this.now();
    const payMoney = this.num(doc.pay_money);

    if (state === 1) {
      // 按支出明细逐条冲减关联费用（pay_money 从左到右分配）
      const infoList = await run('SELECT * FROM `kuyou_expenditure_info` WHERE `purchase_id` = ?', [doc.id]);
      let left = payMoney;
      for (const info of infoList) {
        if (!info.cost_id || left <= 0) continue;
        const cost = (await run('SELECT `id`, `pay_money`, `pay_status` FROM `kuyou_cost` WHERE `id` = ?', [info.cost_id]))[0];
        if (!cost) throw new BadRequestException(`编号${code}审核失败，关联的采购销售费用数据错误`);
        let payStatus: number;
        let used: number;
        if (this.num(cost.pay_money) <= left) {
          payStatus = 1;
          used = this.num(cost.pay_money);
        } else if (left > 0) {
          payStatus = 2;
          used = left;
        } else {
          payStatus = this.num(cost.pay_status);
          used = 0;
        }
        left = this.round(left - used);
        await run('UPDATE `kuyou_cost` SET `pay_money` = `pay_money` - ?, `pay_status` = ? WHERE `id` = ?', [this.round(used), payStatus, cost.id]);
      }
      // 账户支出
      if (doc.accounts_id) {
        const acc = (await run('SELECT `id`, `account_coding`, `account_name`, `balance` FROM `kuyou_accounts` WHERE `id` = ?', [doc.accounts_id]))[0];
        if (acc) {
          await run('UPDATE `kuyou_accounts` SET `balance` = `balance` - ? WHERE `id` = ?', [this.round(payMoney), acc.id]);
          await run(
            'INSERT INTO `kuyou_accounts_log` (`account_coding`, `account_name`, `balance`, `expenditure`, `pay_time`, `bill_code`, `business_type`, `remark`, `createtime`, `updatetime`) VALUES (?, ?, ?, ?, ?, ?, 10, ?, ?, ?)',
            [
              acc.account_coding,
              acc.account_name,
              this.round(this.num(acc.balance) - payMoney),
              this.round(payMoney),
              doc.purchase_time,
              code,
              doc.remark ?? null,
              now,
              now,
            ],
          );
        }
      }
    } else {
      // 反审核：费用冲回（按原分配逆向不易精确复原，按整单金额回冲并复位状态由业务重算）
      if (doc.accounts_id) {
        await run('UPDATE `kuyou_accounts` SET `balance` = `balance` + ? WHERE `id` = ?', [this.round(payMoney), doc.accounts_id]);
      }
      await run('DELETE FROM `kuyou_accounts_log` WHERE `business_type` = 10 AND `bill_code` = ?', [code]);
      await run('DELETE FROM `kuyou_accounts_copewith` WHERE `business_type` = 8 AND `purchase_code` = ?', [code]);
    }
  }

  /* ==================== 转账单 ==================== */

  /**
   * 转账单审核财务联动（对应源 AccountsTransfer::examine）
   * 按转账明细逐行：转出账户支出（流水 12）、转入账户收入（流水 11）。
   */
  private async transfer(run: Runner, doc: any, state: 0 | 1) {
    const code = doc.purchase_code;
    const now = this.now();
    const infoList = await run('SELECT * FROM `kuyou_accounts_transfer_info` WHERE `purchase_id` = ?', [doc.id]);

    if (state === 1) {
      for (const info of infoList) {
        const money = this.round(this.num(info.money));
        const out = (await run('SELECT `id`, `account_coding`, `account_name`, `balance` FROM `kuyou_accounts` WHERE `id` = ?', [info.accounts_out_id]))[0];
        if (!out) throw new BadRequestException(`${info.purchase_code || code}转出账户有误`);
        const enter = (await run('SELECT `id`, `account_coding`, `account_name`, `balance` FROM `kuyou_accounts` WHERE `id` = ?', [info.accounts_enter_id]))[0];
        if (!enter) throw new BadRequestException(`${info.purchase_code || code}转入账户有误`);
        // 转出
        await run('UPDATE `kuyou_accounts` SET `balance` = `balance` - ? WHERE `id` = ?', [money, out.id]);
        await run(
          'INSERT INTO `kuyou_accounts_log` (`account_coding`, `account_name`, `balance`, `expenditure`, `pay_time`, `bill_code`, `business_type`, `remark`, `createtime`, `updatetime`) VALUES (?, ?, ?, ?, ?, ?, 12, ?, ?, ?)',
          [out.account_coding, out.account_name, this.round(this.num(out.balance) - money), money, info.purchase_time, info.purchase_code || code, info.remark ?? null, now, now],
        );
        // 转入
        await run('UPDATE `kuyou_accounts` SET `balance` = `balance` + ? WHERE `id` = ?', [money, enter.id]);
        await run(
          'INSERT INTO `kuyou_accounts_log` (`account_coding`, `account_name`, `balance`, `income`, `pay_time`, `bill_code`, `business_type`, `remark`, `createtime`, `updatetime`) VALUES (?, ?, ?, ?, ?, ?, 11, ?, ?, ?)',
          [enter.account_coding, enter.account_name, this.round(this.num(enter.balance) + money), money, info.purchase_time, info.purchase_code || code, info.remark ?? null, now, now],
        );
      }
    } else {
      await run('DELETE FROM `kuyou_accounts_log` WHERE `bill_code` = ? AND `business_type` IN (11, 12)', [code]);
      for (const info of infoList) {
        const money = this.round(this.num(info.money));
        await run('UPDATE `kuyou_accounts` SET `balance` = `balance` + ? WHERE `id` = ?', [money, info.accounts_out_id]);
        await run('UPDATE `kuyou_accounts` SET `balance` = `balance` - ? WHERE `id` = ?', [money, info.accounts_enter_id]);
      }
    }
  }

  /* ==================== 核销单 ==================== */

  /**
   * 核销单审核财务联动（对应源 Writeoff::examine）
   * 按核销明细逐条推进源单（销货/销货退货/购货/购货退货）的已收付与状态，
   * 并按 top=1 落核销来源流水（sales_payment_log / payment_log，business_type=7）。
   */
  private async writeoff(run: Runner, doc: any, state: 0 | 1) {
    const code = doc.purchase_code;
    const now = this.now();
    const infoList = await run('SELECT * FROM `kuyou_writeoff_info` WHERE `collection_id` = ?', [doc.id]);

    if (state === 1) {
      for (const info of infoList) {
        await this.writeoffSourceDoc(run, info, now);
        if (this.num(info.top) !== 1) continue;
        const src = (await run('SELECT * FROM `kuyou_writeoff_source` WHERE `id` = ?', [info.source_id]))[0];
        if (!src) continue;
        const bt = this.num(info.business_type);
        const type = this.num(info.type);
        const price = this.round(this.num(info.write_off_price));
        if ((bt === 1 && type === 3) || (bt === 3 && type < 4)) {
          // 预收冲应收 / 应收核销：客户侧流水
          await run(
            'INSERT INTO `kuyou_sales_payment_log` (`customers_id`, `bill_time`, `bill_code`, `bill_codes`, `business_type`, `pay_money`, `createtime`) VALUES (?, ?, ?, ?, 7, ?, ?)',
            [src.customers_id, info.purchase_time, info.purchase_number, info.purchase_code, price, now],
          );
        } else if (bt === 2 && type === 3) {
          // 预付冲应付：供应商侧流水
          await run(
            'INSERT INTO `kuyou_payment_log` (`suppliers_code`, `bill_time`, `bill_code`, `bill_codes`, `business_type`, `pay_money`, `createtime`) VALUES (?, ?, ?, ?, 7, ?, ?)',
            [src.suppliers_code, info.purchase_time, info.purchase_number, info.purchase_code, price, now],
          );
        } else if (bt === 4 && type < 4) {
          // 应收转应收：转出客户负流水 + 转入客户正流水
          await run(
            'INSERT INTO `kuyou_sales_payment_log` (`customers_id`, `bill_time`, `bill_code`, `bill_codes`, `business_type`, `pay_money`, `createtime`) VALUES (?, ?, ?, ?, 7, ?, ?)',
            [doc.customers_out_id, info.purchase_time, info.purchase_number, info.purchase_code, -price, now],
          );
          await run(
            'INSERT INTO `kuyou_sales_payment_log` (`customers_id`, `bill_time`, `bill_code`, `bill_codes`, `business_type`, `pay_money`, `createtime`) VALUES (?, ?, ?, ?, 7, ?, ?)',
            [doc.customers_enter_id, info.purchase_time, info.purchase_number, info.purchase_code, price, now],
          );
        } else if (bt === 5 && type < 4) {
          // 应付转应付：转出供应商负流水 + 转入供应商正流水
          const outCode = (await run('SELECT `supplyer_code` FROM `kuyou_suppliers` WHERE `id` = ?', [doc.suppliers_out_id]))[0]?.supplyer_code;
          const enterCode = (await run('SELECT `supplyer_code` FROM `kuyou_suppliers` WHERE `id` = ?', [doc.suppliers_enter_id]))[0]?.supplyer_code;
          await run(
            'INSERT INTO `kuyou_payment_log` (`suppliers_code`, `bill_time`, `bill_code`, `bill_codes`, `business_type`, `pay_money`, `createtime`) VALUES (?, ?, ?, ?, 7, ?, ?)',
            [outCode, info.purchase_time, info.purchase_number, info.purchase_code, -price, now],
          );
          await run(
            'INSERT INTO `kuyou_payment_log` (`suppliers_code`, `bill_time`, `bill_code`, `bill_codes`, `business_type`, `pay_money`, `createtime`) VALUES (?, ?, ?, ?, 7, ?, ?)',
            [enterCode, info.purchase_time, info.purchase_number, info.purchase_code, price, now],
          );
        }
      }
    } else {
      await run('DELETE FROM `kuyou_sales_payment_log` WHERE `bill_codes` = ? AND `business_type` = 7', [code]);
      await run('DELETE FROM `kuyou_payment_log` WHERE `bill_codes` = ? AND `business_type` = 7', [code]);
      await run('DELETE FROM `kuyou_writeoff_source` WHERE `purchase_code` = ? AND `type` = 1', [code]);
    }
  }

  /* ==================== 核销明细 → 源单推进（收/付款共用） ==================== */

  /**
   * 收款单核销明细推进源单（对应源 Collection::examine 的 collection_sale 处理）
   * type=1 普通销售：已收款累加、收款状态推进；type=2 销售退货：已退款累加、退款状态推进。
   */
  private async writeoffSale(run: Runner, info: any, doc: any, now: number) {
    const price = this.round(this.num(info.write_off_price));
    if (this.num(info.business_type) === 3 && this.num(info.type) === 1) {
      const order = (await run('SELECT * FROM `kuyou_goods_sales` WHERE `purchase_code` = ?', [info.purchase_number]))[0];
      if (!order) return;
      const allMoney = this.num(order.real_money);
      const payMoney = this.round(this.num(order.pay_money) + price);
      if (allMoney < payMoney) throw new BadRequestException(`${info.purchase_number}核销金额不能大于未核销金额`);
      const status = allMoney - price - this.num(order.pay_money) <= 0 ? 1 : 2;
      await run('UPDATE `kuyou_goods_sales` SET `pay_money` = ?, `pay_status` = ? WHERE `purchase_code` = ?', [payMoney, status, order.purchase_code]);
      await run(
        'INSERT INTO `kuyou_sales_payment_log` (`customers_id`, `business_type`, `bill_time`, `bill_code`, `bill_codes`, `pay_money`, `reamrk`, `createtime`) VALUES (?, 3, ?, ?, ?, ?, ?, ?)',
        [order.customers_id, now, order.purchase_code, info.purchase_code, price, doc.remarks ?? null, now],
      );
      await this.syncInvoicing(run, 'kuyou_sales_invoicing', 'kuyou_sales_invoicing_log', order.purchase_code, status, info.id, 'kuyou_collection_sale', this.num(order.pay_money), status, 0);
    } else if (this.num(info.business_type) === 3 && this.num(info.type) === 2) {
      const order = (await run('SELECT * FROM `kuyou_goods_sales_exchange` WHERE `purchase_code` = ?', [info.purchase_number]))[0];
      if (!order) return;
      const allMoney = this.num(order.real_money);
      const payMoney = this.round(this.num(order.retreat_money) - price);
      if (allMoney < payMoney) throw new BadRequestException(`${info.purchase_number}核销金额不能大于未核销金额`);
      const status = allMoney + price - this.num(order.retreat_money) === 0 ? 1 : 2;
      await run('UPDATE `kuyou_goods_sales_exchange` SET `retreat_money` = ?, `retreat_status` = ? WHERE `purchase_code` = ?', [payMoney, status, order.purchase_code]);
      await run(
        'INSERT INTO `kuyou_sales_payment_log` (`customers_id`, `business_type`, `bill_time`, `bill_code`, `bill_codes`, `pay_money`, `reamrk`, `createtime`) VALUES (?, 4, ?, ?, ?, ?, ?, ?)',
        [order.customers_id, now, order.purchase_code, info.purchase_code, price, doc.remarks ?? null, now],
      );
      const incomeStatus = (await run('SELECT `status` FROM `kuyou_sales_invoicing` WHERE `bill_code` = ?', [order.purchase_code]))[0]?.status;
      if (incomeStatus !== undefined) {
        await run('UPDATE `kuyou_sales_invoicing` SET `status` = ? WHERE `bill_code` = ?', [this.num(incomeStatus) + 3, order.purchase_code]);
        await run('UPDATE `kuyou_sales_invoicing_log` SET `status` = ? WHERE `bill_code` = ?', [this.num(incomeStatus) + 3, order.purchase_code]);
      }
      await run('UPDATE `kuyou_collection_sale` SET `old_money` = ?, `old_status` = ? WHERE `id` = ?', [this.num(order.retreat_money), status, info.id]);
    }
  }

  /**
   * 付款单核销明细推进源单（对应源 Payment::examine 的 payment_sale 处理）
   * type=1 普通购货：已付款累加、付款状态推进；type=2 购货退货：已退款累加、退款状态推进。
   */
  private async writeoffPurchase(run: Runner, info: any, doc: any, now: number) {
    const price = this.round(this.num(info.write_off_price));
    if (this.num(info.business_type) === 4 && this.num(info.type) === 1) {
      const order = (await run('SELECT * FROM `kuyou_goods_purchase` WHERE `purchase_code` = ?', [info.purchase_number]))[0];
      if (!order) return;
      const allMoney = this.num(order.real_money);
      const payMoney = this.round(this.num(order.pay_money) + price);
      if (allMoney < payMoney) throw new BadRequestException(`${info.purchase_number}核销金额不能大于未核销金额`);
      const status = allMoney - price - this.num(order.pay_money) <= 0 ? 1 : 2;
      await run('UPDATE `kuyou_goods_purchase` SET `pay_money` = ?, `pay_status` = ? WHERE `purchase_code` = ?', [payMoney, status, order.purchase_code]);
      await run(
        'INSERT INTO `kuyou_payment_log` (`suppliers_code`, `business_type`, `bill_time`, `bill_code`, `bill_codes`, `pay_money`, `reamrk`, `createtime`) VALUES (?, 3, ?, ?, ?, ?, ?, ?)',
        [order.supplyer_code, now, order.purchase_code, info.purchase_code, price, doc.remarks ?? null, now],
      );
      await this.syncInvoicing(run, 'kuyou_invoicing', 'kuyou_invoicing_log', order.purchase_code, status, info.id, 'kuyou_payment_sale', this.num(order.pay_money), status, 0);
    } else if (this.num(info.business_type) === 4 && this.num(info.type) === 2) {
      const order = (await run('SELECT * FROM `kuyou_goods_exchange` WHERE `purchase_code` = ?', [info.purchase_number]))[0];
      if (!order) return;
      const allMoney = this.round(this.num(order.all_money) + this.num(order.tax_money));
      const payMoney = this.round(this.num(order.retreat_money) - price);
      const status = allMoney + price - this.num(order.retreat_money) === 0 ? 1 : 2;
      await run('UPDATE `kuyou_goods_exchange` SET `retreat_money` = ?, `retreat_status` = ? WHERE `purchase_code` = ?', [payMoney, status, order.purchase_code]);
      await run(
        'INSERT INTO `kuyou_payment_log` (`suppliers_code`, `business_type`, `bill_time`, `bill_code`, `bill_codes`, `pay_money`, `reamrk`, `createtime`) VALUES (?, 4, ?, ?, ?, ?, ?, ?)',
        [order.supplyer_code, now, order.purchase_code, info.purchase_code, price, doc.remarks ?? null, now],
      );
      await run('UPDATE `kuyou_payment_sale` SET `old_money` = ?, `old_status` = ? WHERE `id` = ?', [this.num(order.retreat_money), status, info.id]);
    }
  }

  /**
   * 核销后同步开票登记状态（对应源 examine 中 invoicing / invoicing_log 的 status 更新）
   */
  private async syncInvoicing(
    run: Runner,
    invTable: string,
    invLogTable: string,
    billCode: string,
    status: number,
    infoId: number,
    saleTable: string,
    oldMoney: number,
    oldStatus: number,
    oldStatusI: number,
  ) {
    const income = (await run('SELECT `status` FROM `' + invTable + '` WHERE `bill_code` = ?', [billCode]))[0];
    await run('UPDATE `' + saleTable + '` SET `old_money` = ?, `old_status` = ?, `old_status_i` = ? WHERE `id` = ?', [
      oldMoney,
      oldStatus,
      income ? this.num(income.status) : oldStatusI,
      infoId,
    ]);
    if (income) {
      await run('UPDATE `' + invTable + '` SET `status` = ? WHERE `bill_code` = ?', [status, billCode]);
      await run('UPDATE `' + invLogTable + '` SET `status` = ? WHERE `bill_code` = ?', [status, billCode]);
    }
  }

  /* ==================== 核销单源单推进 ==================== */

  /**
   * 核销单明细推进源单（对应源 Writeoff::examine 的 writeoff_info 处理）
   * purchase_type: 3=销售 4=购货；type: 1=正常单 2=退货单
   */
  private async writeoffSourceDoc(run: Runner, info: any, now: number) {
    const price = this.round(this.num(info.write_off_price));
    const pt = this.num(info.purchase_type);
    const type = this.num(info.type);
    if (pt === 3 && type === 1) {
      const order = (await run('SELECT * FROM `kuyou_goods_sales` WHERE `purchase_code` = ?', [info.purchase_number]))[0];
      if (!order) return;
      const more = this.round(this.num(order.money_tax_price) - price - this.num(order.pay_money));
      const status = more <= 0 ? 1 : 2;
      await run('UPDATE `kuyou_goods_sales` SET `pay_money` = `pay_money` + ?, `pay_status` = ? WHERE `purchase_code` = ?', [price, status, order.purchase_code]);
    } else if (pt === 3 && type === 2) {
      const order = (await run('SELECT * FROM `kuyou_goods_sales_exchange` WHERE `purchase_code` = ?', [info.purchase_number]))[0];
      if (!order) return;
      const more = this.round(this.num(order.money_tax_price) + price - this.num(order.retreat_money));
      const status = more === 0 ? 1 : 2;
      await run('UPDATE `kuyou_goods_sales_exchange` SET `retreat_money` = `retreat_money` - ?, `retreat_status` = ? WHERE `purchase_code` = ?', [price, status, order.purchase_code]);
    } else if (pt === 4 && type === 1) {
      const order = (await run('SELECT * FROM `kuyou_goods_purchase` WHERE `purchase_code` = ?', [info.purchase_number]))[0];
      if (!order) return;
      const more = this.round(this.num(order.all_money) + this.num(order.tax_money) - price - this.num(order.pay_money));
      const status = more <= 0 ? 1 : 2;
      await run('UPDATE `kuyou_goods_purchase` SET `pay_money` = `pay_money` + ?, `pay_status` = ? WHERE `purchase_code` = ?', [price, status, order.purchase_code]);
    } else if (pt === 4 && type === 2) {
      const order = (await run('SELECT * FROM `kuyou_goods_exchange` WHERE `purchase_code` = ?', [info.purchase_number]))[0];
      if (!order) return;
      const more = this.round(this.num(order.all_money) + this.num(order.tax_money) + price - this.num(order.retreat_money));
      const status = more === 0 ? 1 : 2;
      await run('UPDATE `kuyou_goods_exchange` SET `retreat_money` = `retreat_money` - ?, `retreat_status` = ? WHERE `purchase_code` = ?', [price, status, order.purchase_code]);
    }
  }

  /** 当前秒级时间戳 */
  private now(): number {
    return Math.floor(Date.now() / 1000);
  }

  /** 列存在判定（供扩展使用） */
  protected hasCol(table: string, col: string): boolean {
    return (TABLE_META[table]?.columns || []).includes(col);
  }
}
