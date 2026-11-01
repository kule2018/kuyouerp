import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

/**
 * 往来对账单服务（1:1 还原源 CustomersRecon.php / SuppliersRecon.php）
 *
 * 整体思路：
 *  1) 先取往来单位（客户 join 客户分类 / 供应商 join 供应商分类），按编码升序；
 *  2) 每个单位先插一行「期初余额」（客户 = 应收余额 - 期初预收；供应商 = 期初应付 - 期初预付）；
 *  3) 再按时间范围取其应收/应付流水（business_type 排除 1、2，即排除期初与单据本身之外的类型），
 *     business_type = 7（收款单/付款单）方向取负，其余方向取正，逐行滚动余额；
 *  4) 每个单位末尾插一行「小计」，并把小计累加进总计；
 *  5) 返回 layui 约定的 { total, rows } 并附带五项合计字段。
 */
@Injectable()
export class ReconService {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  /** 执行 SQL（占位符 ?） */
  private async q(sql: string, params: any[] = []): Promise<any[]> {
    const r = await this.conn.query(sql, params);
    return Array.isArray(r) ? r : [];
  }

  /** 读取系统设置（kuyou_sets 按 name 建索引） */
  private async sets(): Promise<Record<string, any>> {
    const rows = await this.q('SELECT `type`, `name`, `value`, `is_checked`, `set` FROM `kuyou_sets`');
    const out: Record<string, any> = {};
    for (const v of rows) out[v.name] = v;
    return out;
  }

  /** 数值化（空串/undefined 一律按 0，避免 NaN 传播） */
  private num(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /** 按小数位四舍五入（与源 round(x, price_decimal) 一致） */
  private round(v: number, dec: number): number {
    const p = Math.pow(10, Math.max(0, Math.min(8, Number(dec) || 0)));
    return Math.round(v * p) / p;
  }

  /** bigint 秒时间戳 → YYYY-MM-DD（源 date('Y-m-d', ts)） */
  private date(t: any): string {
    const n = this.num(t);
    if (!n) return '';
    const d = new Date(n * 1000);
    const p = (x: number) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /**
   * 解析前端 filter（JSON 字符串或对象），抽出时间范围与往来单位过滤
   * @returns { from, to, partyId, staffId, idLessThan }
   */
  private parseFilter(filter: any) {
    let f: any = {};
    if (typeof filter === 'string' && filter) {
      try {
        f = JSON.parse(filter) || {};
      } catch {
        f = {};
      }
    } else if (filter && typeof filter === 'object') {
      f = filter;
    }
    const out: any = { from: 0, to: 0, partyId: '', staffId: '', idLessThan: 0 };
    if (f.purchase_time) {
      const arr = String(f.purchase_time).split(' - ');
      // 源端直接 strtotime('Y-m-d')，即当天 00:00:00
      out.from = Math.floor(new Date(String(arr[0]).trim()).getTime() / 1000);
      out.to = arr[1] ? Math.floor(new Date(String(arr[1]).trim()).getTime() / 1000) : 0;
    }
    if (f.customers_id) out.partyId = String(f.customers_id).trim();
    if (f.suppliers_id) out.partyId = String(f.suppliers_id).trim();
    if (f.staff_member_id) out.staffId = String(f.staff_member_id).trim();
    if (f.id) out.idLessThan = this.num(f.id);
    return out;
  }

  /**
   * 客户对账单（源 kuyou/customers_recon/index）
   * @param filter 前端 filter（JSON 字符串或对象）
   * @param sort   排序字段，默认 createtime
   * @param order  排序方向，默认 ASC
   */
  async customers(filter: any, sort?: string, order?: string) {
    const set = await this.sets();
    const dec = this.num(set['price_decimal']?.value) || 2;
    const f = this.parseFilter(filter);

    // 客户列表：join 客户分类取分类名；可选按客户 id 过滤 / id 小于某值（上翻页语义）
    const where: string[] = [];
    const params: any[] = [];
    if (f.partyId) {
      where.push('sp.`id` = ?');
      params.push(f.partyId);
    }
    if (f.idLessThan) {
      where.push('sp.`id` < ?');
      params.push(f.idLessThan);
    }
    const sql =
      'SELECT sp.`id`, sp.`opening_prepayment`, sp.`customer_code`, sp.`customer_name`, ' +
      'sp.`receive_account`, gt.`type_name` ' +
      'FROM `kuyou_customers` sp LEFT JOIN `kuyou_customertype` gt ON sp.`customertype_id` = gt.`id`' +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY sp.`customer_code` ASC';
    const parties = await this.q(sql, params);

    // 职员 id → 姓名映射（源 Db::name('kuyou_staff_member')->column('id','name')）
    const staffRows = await this.q('SELECT `id`, `name` FROM `kuyou_staff_member`');
    const staffName: Record<string, string> = {};
    for (const s of staffRows) staffName[s.id] = s.name;

    const rows: any[] = [];
    let allSale = 0;
    let allReceivable = 0;
    let allCost = 0;
    let allReal = 0;
    let allBalance = 0;

    for (const p of parties) {
      // 期初余额：应收余额 - 期初预收（源 round(receive_account - opening_prepayment)）
      const opening = this.round(this.num(p.receive_account) - this.num(p.opening_prepayment), dec);
      let balance = 0;
      rows.push({
        customer_name: p.customer_name,
        purchase_time: '',
        purchase_code: '期初余额',
        business_type: '',
        sale_money: '',
        receivable: '',
        amount: '',
        cost: '',
        real_money: '',
        balance: opening,
        staff_member: '',
        remark: '',
      });
      balance += opening;

      let sale = 0;
      let receivable = 0;
      let cost = 0;
      let real = 0;

      // 应收流水：business_type 排除 1、2
      const w: string[] = ['`customers_id` = ?', '`business_type` NOT IN (1,2)'];
      const ps: any[] = [p.id];
      if (f.from && f.to) {
        w.push('`purchase_time` BETWEEN ? AND ?');
        ps.push(f.from, f.to);
      } else if (f.from) {
        w.push('`purchase_time` >= ?');
        ps.push(f.from);
      }
      if (f.staffId) {
        w.push('`staff_member_id` = ?');
        ps.push(f.staffId);
      }
      const orderField = this.safeSort(sort);
      const orderDir = String(order || '').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      const list = await this.q(
        `SELECT * FROM \`kuyou_accounts_receivable\` WHERE ${w.join(' AND ')} ORDER BY \`${orderField}\` ${orderDir}`,
        ps,
      );

      for (const v of list) {
        const isPay = Number(v.business_type) === 7; // 收款单：方向取负
        const sign = isPay ? -1 : 1;
        balance += isPay
          ? -this.num(v.receivable_money) + this.num(v.real_money)
          : this.num(v.receivable_money) - this.num(v.real_money);
        sale += sign * this.num(v.sale_money);
        receivable += sign * this.num(v.receivable_money);
        cost += sign * this.num(v.cost);
        real += sign * this.num(v.real_money);
        rows.push({
          customer_name: p.customer_name,
          purchase_time: this.date(v.purchase_time),
          purchase_code: v.purchase_code,
          business_type: v.business_type,
          sale_money: sign * this.num(v.sale_money),
          receivable: sign * this.num(v.receivable_money),
          amount: sign * this.num(v.amount),
          cost: sign * this.num(v.cost),
          real_money: sign * this.num(v.real_money),
          balance: this.round(balance, dec),
          staff_member: staffName[v.staff_member_id] || '',
          remark: v.remark,
        });
      }

      rows.push({
        customer_name: p.customer_name,
        purchase_time: '',
        purchase_code: '小计',
        business_type: '',
        sale_money: this.round(sale, dec),
        receivable: this.round(receivable, dec),
        amount: '',
        cost: this.round(cost, dec),
        real_money: this.round(real, dec),
        balance: this.round(balance, dec),
        staff_member: '',
        remark: '',
      });

      allSale += sale;
      allReceivable += receivable;
      allCost += cost;
      allReal += real;
      allBalance += balance;
    }

    return {
      total: rows.length,
      rows,
      all_sale_money: allSale,
      all_receivable: allReceivable,
      all_cost: allCost,
      all_real_money: allReal,
      all_balance: allBalance,
    };
  }

  /**
   * 供应商对账单（源 kuyou/suppliers_recon/index）
   * 与客户对账单镜像：单位为供应商，流水表换成应付表，期初 = 期初应付 - 期初预付。
   */
  async suppliers(filter: any, sort?: string, order?: string) {
    const set = await this.sets();
    const dec = this.num(set['price_decimal']?.value) || 2;
    const f = this.parseFilter(filter);

    const where: string[] = [];
    const params: any[] = [];
    if (f.partyId) {
      where.push('sp.`id` = ?');
      params.push(f.partyId);
    }
    if (f.idLessThan) {
      where.push('sp.`id` < ?');
      params.push(f.idLessThan);
    }
    const sql =
      'SELECT sp.`id`, sp.`receive_account`, sp.`supplyer_code`, sp.`supplyer_name`, ' +
      'gt.`supplier_type_name`, sp.`opening_payable`, sp.`opening_prepayment` ' +
      'FROM `kuyou_suppliers` sp LEFT JOIN `kuyou_supplyertype` gt ON sp.`supplyertype_id` = gt.`id`' +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY sp.`supplyer_code` ASC';
    const parties = await this.q(sql, params);

    const rows: any[] = [];
    let allSale = 0;
    let allReceivable = 0;
    let allCost = 0;
    let allReal = 0;
    let allBalance = 0;

    for (const p of parties) {
      const opening = this.round(this.num(p.opening_payable) - this.num(p.opening_prepayment), dec);
      let balance = 0;
      rows.push({
        customer_name: p.supplyer_name,
        purchase_time: '',
        purchase_code: '期初余额',
        business_type: '',
        sale_money: '',
        receivable: '',
        amount: '',
        cost: '',
        real_money: '',
        balance: opening,
        remark: '',
      });
      balance += opening;

      let sale = 0;
      let receivable = 0;
      let cost = 0;
      let real = 0;

      const w: string[] = ['`suppliers_id` = ?', '`business_type` NOT IN (1,2)'];
      const ps: any[] = [p.id];
      if (f.from && f.to) {
        w.push('`purchase_time` BETWEEN ? AND ?');
        ps.push(f.from, f.to);
      } else if (f.from) {
        w.push('`purchase_time` >= ?');
        ps.push(f.from);
      }
      if (f.staffId) {
        w.push('`staff_member_id` = ?');
        ps.push(f.staffId);
      }
      const orderField = this.safeSort(sort);
      const orderDir = String(order || '').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      const list = await this.q(
        `SELECT * FROM \`kuyou_accounts_copewith\` WHERE ${w.join(' AND ')} ORDER BY \`${orderField}\` ${orderDir}`,
        ps,
      );

      for (const v of list) {
        const isPay = Number(v.business_type) === 7; // 付款单：方向取负
        const sign = isPay ? -1 : 1;
        balance += isPay
          ? -this.num(v.receivable_money) + this.num(v.real_money)
          : this.num(v.receivable_money) - this.num(v.real_money);
        sale += sign * this.num(v.sale_money);
        receivable += sign * this.num(v.receivable_money);
        cost += sign * this.num(v.cost);
        real += sign * this.num(v.real_money);
        rows.push({
          customer_name: p.supplyer_name,
          purchase_time: this.date(v.purchase_time),
          purchase_code: v.purchase_code,
          business_type: v.business_type,
          sale_money: sign * this.num(v.sale_money),
          receivable: sign * this.num(v.receivable_money),
          amount: sign * this.num(v.amount),
          cost: sign * this.num(v.cost),
          real_money: sign * this.num(v.real_money),
          balance: this.round(balance, dec),
          remark: v.remark,
        });
      }

      rows.push({
        customer_name: p.supplyer_name,
        purchase_time: '',
        purchase_code: '小计',
        business_type: '',
        sale_money: this.round(sale, dec),
        receivable: this.round(receivable, dec),
        amount: '',
        cost: this.round(cost, dec),
        real_money: this.round(real, dec),
        balance: this.round(balance, dec),
        remark: '',
      });

      allSale += sale;
      allReceivable += receivable;
      allCost += cost;
      allReal += real;
      allBalance += balance;
    }

    return {
      total: rows.length,
      rows,
      all_sale_money: allSale,
      all_receivable: allReceivable,
      all_cost: allCost,
      all_real_money: allReal,
      all_balance: this.round(allBalance, dec),
    };
  }

  /** 排序字段白名单，防止注入（源可传任意 field，这里收敛到流水表实际字段） */
  private safeSort(sort?: string): string {
    const allow = ['createtime', 'purchase_time', 'purchase_code', 'id', 'business_type', 'receivable_money', 'real_money'];
    const s = String(sort || '').trim();
    return allow.indexOf(s) >= 0 ? s : 'createtime';
  }

  /**
   * 商品收发明细汇总（1:1 还原源 GoodsLogSummary.php::index）
   *
   * 口径：按「商品 + 仓库」分组，期初取 business_type=1 的 balance_basics/balance_cost；
   * 入库侧统计 6 调拨入库 / 2 普通采购 / 5 销售退回 / 8 盘盈 / 9 其他入库 / 17 生产 / 19 退料
   * 的 enter_basics/enter_cost；出库侧统计 6 调拨出库 / 4 普通销售 / 3 采购退回 / 10 盘亏 /
   * 11 其他出库 / 20 委外加工 / 18 领料单 的 out_basics/out_cost；
   * 结存 = 期初 + 入库 - 出库；数量/金额分别按 number_decimal、price_decimal 四舍五入。
   *
   * 实现说明：源端对每个分组跑 15 次独立 SUM 查询（N+1），这里等价地用一条
   * SUM(CASE WHEN business_type = ? ...) 的分组聚合完成，结果与源一致。
   */
  async goodsLogSummary(filter: any) {
    const set = await this.sets();
    const nd = this.num(set['number_decimal']?.value);
    const pd = this.num(set['price_decimal']?.value);

    // filter 解析：id → 小于；含 ' - ' 且字段名含 time → BETWEEN；其余 → LIKE
    const conds: string[] = [];
    const ps: any[] = [];
    let f: any = {};
    if (typeof filter === 'string' && filter) {
      try {
        f = JSON.parse(filter) || {};
      } catch {
        f = {};
      }
    } else if (filter && typeof filter === 'object') {
      f = filter;
    }
    for (const k of Object.keys(f)) {
      const v = f[k];
      if (v === '' || v === null || v === undefined) continue;
      if (k === 'id') {
        conds.push('gl.`id` < ?');
        ps.push(this.num(v));
      } else if (String(v).indexOf(' - ') >= 0 && k.indexOf('time') >= 0) {
        const arr = String(v).split(' - ');
        conds.push('gl.`' + this.safeCol(k) + '` BETWEEN ? AND ?');
        ps.push(Math.floor(new Date(String(arr[0]).trim()).getTime() / 1000));
        ps.push(Math.floor(new Date(String(arr[1]).trim()).getTime() / 1000));
      } else {
        conds.push('gl.`' + this.safeCol(k) + '` LIKE ?');
        ps.push(`%${v}%`);
      }
    }
    const where = conds.length ? ' WHERE ' + conds.join(' AND ') : '';

    // 必须先关闭 ONLY_FULL_GROUP_BY（源端 SET @@sql_mode='' 就是为此）
    const groups = await this.q(
      'SELECT gl.`goods_id`, gl.`stores_id`, ' +
        "SUM(CASE WHEN gl.`business_type` = 1 THEN gl.`balance_basics` ELSE 0 END) AS `period_basics`, " +
        "SUM(CASE WHEN gl.`business_type` = 1 THEN gl.`balance_cost` ELSE 0 END) AS `period_cost`, " +
        // ---- 入库侧 ----
        "SUM(CASE WHEN gl.`business_type` = 6 THEN gl.`enter_basics` ELSE 0 END) AS `allocation_e_basics`, " +
        "SUM(CASE WHEN gl.`business_type` = 6 THEN gl.`enter_cost` ELSE 0 END) AS `allocation_e_cost`, " +
        "SUM(CASE WHEN gl.`business_type` = 2 THEN gl.`enter_basics` ELSE 0 END) AS `buy_o_basics`, " +
        "SUM(CASE WHEN gl.`business_type` = 2 THEN gl.`enter_cost` ELSE 0 END) AS `buy_o_cost`, " +
        "SUM(CASE WHEN gl.`business_type` = 5 THEN gl.`enter_basics` ELSE 0 END) AS `sale_e_basics`, " +
        "SUM(CASE WHEN gl.`business_type` = 5 THEN gl.`enter_cost` ELSE 0 END) AS `sale_e_cost`, " +
        "SUM(CASE WHEN gl.`business_type` = 8 THEN gl.`enter_basics` ELSE 0 END) AS `surplus_basics`, " +
        "SUM(CASE WHEN gl.`business_type` = 8 THEN gl.`enter_cost` ELSE 0 END) AS `surplus_cost`, " +
        "SUM(CASE WHEN gl.`business_type` = 9 THEN gl.`enter_basics` ELSE 0 END) AS `other_e_basics`, " +
        "SUM(CASE WHEN gl.`business_type` = 9 THEN gl.`enter_cost` ELSE 0 END) AS `other_e_cost`, " +
        "SUM(CASE WHEN gl.`business_type` = 17 THEN gl.`enter_basics` ELSE 0 END) AS `productions_basics`, " +
        "SUM(CASE WHEN gl.`business_type` = 17 THEN gl.`enter_cost` ELSE 0 END) AS `productions_cost`, " +
        "SUM(CASE WHEN gl.`business_type` = 19 THEN gl.`enter_basics` ELSE 0 END) AS `material_basics`, " +
        "SUM(CASE WHEN gl.`business_type` = 19 THEN gl.`enter_cost` ELSE 0 END) AS `material_cost`, " +
        // ---- 出库侧 ----
        "SUM(CASE WHEN gl.`business_type` = 6 THEN gl.`out_basics` ELSE 0 END) AS `allocation_o_basics`, " +
        "SUM(CASE WHEN gl.`business_type` = 6 THEN gl.`out_cost` ELSE 0 END) AS `allocation_o_cost`, " +
        "SUM(CASE WHEN gl.`business_type` = 4 THEN gl.`out_basics` ELSE 0 END) AS `sale_o_basics`, " +
        "SUM(CASE WHEN gl.`business_type` = 4 THEN gl.`out_cost` ELSE 0 END) AS `sale_o_cost`, " +
        "SUM(CASE WHEN gl.`business_type` = 3 THEN gl.`out_basics` ELSE 0 END) AS `buy_e_basics`, " +
        "SUM(CASE WHEN gl.`business_type` = 3 THEN gl.`out_cost` ELSE 0 END) AS `buy_e_cost`, " +
        "SUM(CASE WHEN gl.`business_type` = 10 THEN gl.`out_basics` ELSE 0 END) AS `loss_basics`, " +
        "SUM(CASE WHEN gl.`business_type` = 10 THEN gl.`out_cost` ELSE 0 END) AS `loss_cost`, " +
        "SUM(CASE WHEN gl.`business_type` = 11 THEN gl.`out_basics` ELSE 0 END) AS `other_o_basics`, " +
        "SUM(CASE WHEN gl.`business_type` = 11 THEN gl.`out_cost` ELSE 0 END) AS `other_o_cost`, " +
        "SUM(CASE WHEN gl.`business_type` = 20 THEN gl.`out_basics` ELSE 0 END) AS `outsourcing_basics`, " +
        "SUM(CASE WHEN gl.`business_type` = 20 THEN gl.`out_cost` ELSE 0 END) AS `outsourcing_cost`, " +
        "SUM(CASE WHEN gl.`business_type` = 18 THEN gl.`out_basics` ELSE 0 END) AS `picking_basics`, " +
        "SUM(CASE WHEN gl.`business_type` = 18 THEN gl.`out_cost` ELSE 0 END) AS `picking_cost` " +
        'FROM `kuyou_goods_log` gl' +
        where +
        ' GROUP BY gl.`goods_id`, gl.`stores_id`',
      ps,
    );

    // 商品 / 仓库 / 分类 / 单位 名称回填
    const goodsIds = groups.map((g: any) => g.goods_id);
    const storeIds = groups.map((g: any) => g.stores_id);
    const goodsMap: Record<string, any> = {};
    const storeMap: Record<string, any> = {};
    const typeMap: Record<string, string> = {};
    const unitMap: Record<string, string> = {};
    if (goodsIds.length) {
      const ph = goodsIds.map(() => '?').join(',');
      const goods = await this.q(
        'SELECT `id`, `goods_code`, `goods_name`, `goods_type_id`, `goods_barcode`, `goods_specification_id`, `note`, `unit_id` ' +
          `FROM \`kuyou_goods\` WHERE \`id\` IN (${ph})`,
        goodsIds,
      );
      for (const g of goods) goodsMap[g.id] = g;
      const typeIds = goods.map((g: any) => g.goods_type_id).filter(Boolean);
      if (typeIds.length) {
        const tph = typeIds.map(() => '?').join(',');
        const types = await this.q(
          `SELECT \`id\`, \`supplier_type_name\` FROM \`kuyou_goods_type\` WHERE \`id\` IN (${tph})`,
          typeIds,
        );
        for (const t of types) typeMap[t.id] = t.supplier_type_name;
      }
      const unitIds = goods.map((g: any) => g.unit_id).filter(Boolean);
      if (unitIds.length) {
        const uph = unitIds.map(() => '?').join(',');
        const units = await this.q(`SELECT \`id\`, \`name\` FROM \`kuyou_unit\` WHERE \`id\` IN (${uph})`, unitIds);
        for (const u of units) unitMap[u.id] = u.name;
      }
    }
    if (storeIds.length) {
      const sph = storeIds.map(() => '?').join(',');
      const stores = await this.q(
        `SELECT \`id\`, \`store_code\`, \`name\` FROM \`kuyou_stores\` WHERE \`id\` IN (${sph})`,
        storeIds,
      );
      for (const s of stores) storeMap[s.id] = s;
    }

    // 数量/金额键分别按 number_decimal / price_decimal 规整（与源 $format 一致）
    const numKeys = [
      'period_basics', 'allocation_e_basics', 'buy_o_basics', 'sale_e_basics', 'surplus_basics', 'other_e_basics',
      'productions_basics', 'material_basics', 'allocation_o_basics', 'sale_o_basics', 'buy_e_basics', 'loss_basics',
      'other_o_basics', 'outsourcing_basics', 'picking_basics', 'enter_basics', 'out_basics', 'balance_basics',
    ];
    const priceKeys = [
      'period_cost', 'allocation_e_cost', 'buy_o_cost', 'sale_e_cost', 'surplus_cost', 'other_e_cost',
      'productions_cost', 'material_cost', 'allocation_o_cost', 'sale_o_cost', 'buy_e_cost', 'loss_cost',
      'other_o_cost', 'outsourcing_cost', 'picking_cost', 'enter_cost', 'out_cost', 'balance_cost',
    ];

    const rows = groups.map((g: any) => {
      const gd = goodsMap[g.goods_id] || {};
      const st = storeMap[g.stores_id] || {};
      const enterBasics =
        this.num(g.allocation_e_basics) + this.num(g.buy_o_basics) + this.num(g.sale_e_basics) +
        this.num(g.surplus_basics) + this.num(g.other_e_basics) + this.num(g.productions_basics) + this.num(g.material_basics);
      const enterCost =
        this.num(g.allocation_e_cost) + this.num(g.buy_o_cost) + this.num(g.sale_e_cost) +
        this.num(g.surplus_cost) + this.num(g.other_e_cost) + this.num(g.productions_cost) + this.num(g.material_cost);
      const outBasics =
        this.num(g.allocation_o_basics) + this.num(g.sale_o_basics) + this.num(g.buy_e_basics) +
        this.num(g.loss_basics) + this.num(g.other_o_basics) + this.num(g.outsourcing_basics) + this.num(g.picking_basics);
      const outCost =
        this.num(g.allocation_o_cost) + this.num(g.sale_o_cost) + this.num(g.buy_e_cost) +
        this.num(g.loss_cost) + this.num(g.other_o_cost) + this.num(g.outsourcing_cost) + this.num(g.picking_cost);
      const row: any = {
        ...g,
        goods_code: gd.goods_code,
        goods_name: gd.goods_name,
        goods_spec: gd.goods_specification_id,
        goods_barcode: gd.goods_barcode,
        type_name: typeMap[gd.goods_type_id] || '',
        unit_name: unitMap[gd.unit_id] || '',
        store_code: st.store_code,
        store_name: st.name,
        enter_basics: enterBasics,
        enter_cost: enterCost,
        out_basics: outBasics,
        out_cost: outCost,
        balance_basics: this.num(g.period_basics) + enterBasics - outBasics,
        balance_cost: this.num(g.period_cost) + enterCost - outCost,
      };
      for (const k of numKeys) if (row[k] !== undefined && row[k] !== null) row[k] = this.round(this.num(row[k]), nd);
      for (const k of priceKeys) if (row[k] !== undefined && row[k] !== null) row[k] = this.round(this.num(row[k]), pd);
      return row;
    });

    return { total: rows.length, rows };
  }

  /**
   * 序列号状态查询（1:1 还原源 GoodsSerialStatus.php::index）
   * 口径：按 serial 分组取 max(id)（即最新一条流转记录）代表该序列号的当前状态；
   * 再回查 `kuyou_goods_serial_log` 取明细，并按 business_type 决定往来单位取供应商还是客户
   * （2/3/7/8 → 供应商，4/5/9/10 → 客户）。
   */
  async goodsSerialStatus(filter: any, storeStatus: any, page = 1, limit = 20) {
    let f: any = {};
    if (typeof filter === 'string' && filter) {
      try {
        f = JSON.parse(filter) || {};
      } catch {
        f = {};
      }
    } else if (filter && typeof filter === 'object') {
      f = filter;
    }

    // store_status 非空时：先按状态 + 商品/序列号过滤拿到 serial 集合，再按集合取最新记录
    let serialScope: string[] | null = null;
    if (storeStatus !== undefined && storeStatus !== null && storeStatus !== '') {
      const w: string[] = ['`store_status` = ?'];
      const ps: any[] = [this.num(storeStatus)];
      if (f.goods_id) {
        const ids = String(f.goods_id).split(',');
        w.push('`goods_id` IN (' + ids.map(() => '?').join(',') + ')');
        ps.push(...ids);
      }
      if (f.serial) {
        const ss = String(f.serial).split(',');
        w.push('`serial` IN (' + ss.map(() => '?').join(',') + ')');
        ps.push(...ss);
      }
      const hit = await this.q('SELECT `serial` FROM `kuyou_goods_serial` WHERE ' + w.join(' AND '), ps);
      serialScope = hit.map((h: any) => h.serial);
      if (!serialScope.length) return { total: 0, rows: [] };
    }

    const offset = (Math.max(1, page) - 1) * limit;
    const scopeSql = serialScope ? ' WHERE `serial` IN (' + serialScope.map(() => '?').join(',') + ') ' : '';
    const scopeParams = serialScope || [];
    const grouped = await this.q(
      'SELECT MAX(`id`) AS `id` FROM `kuyou_goods_serial`' + scopeSql + ' GROUP BY `serial` LIMIT ? OFFSET ?',
      [...scopeParams, limit, offset],
    );
    const cnt = await this.q(
      'SELECT COUNT(*) AS `total` FROM (SELECT MAX(`id`) AS `id` FROM `kuyou_goods_serial`' + scopeSql + ' GROUP BY `serial`) t',
      scopeParams,
    );
    const ids = grouped.map((g: any) => g.id);
    if (!ids.length) return { total: this.num(cnt[0]?.total), rows: [] };

    const ph = ids.map(() => '?').join(',');
    const logs = await this.q(`SELECT * FROM \`kuyou_goods_serial_log\` WHERE \`id\` IN (${ph})`, ids);

    // 商品 / 仓库 / 往来单位名称回填
    const goodsIds = logs.map((l: any) => l.goods_id).filter(Boolean);
    const storeIds = logs.map((l: any) => l.stores_id).filter(Boolean);
    const goodsMap: Record<string, any> = {};
    const storeMap: Record<string, any> = {};
    if (goodsIds.length) {
      const gph = goodsIds.map(() => '?').join(',');
      const gs = await this.q(
        `SELECT \`id\`, \`goods_code\`, \`goods_name\`, \`goods_barcode\`, \`goods_specification_id\` FROM \`kuyou_goods\` WHERE \`id\` IN (${gph})`,
        goodsIds,
      );
      for (const g of gs) goodsMap[g.id] = g;
    }
    if (storeIds.length) {
      const sph = storeIds.map(() => '?').join(',');
      const ss = await this.q(`SELECT \`id\`, \`store_code\`, \`name\` FROM \`kuyou_stores\` WHERE \`id\` IN (${sph})`, storeIds);
      for (const s of ss) storeMap[s.id] = s;
    }

    const rows: any[] = [];
    for (const info of logs) {
      const gd = goodsMap[info.goods_id] || {};
      const st = storeMap[info.stores_id] || {};
      const bt = Number(info.business_type);
      let customerName = '';
      if ([2, 3, 7, 8].includes(bt) && info.customer_id) {
        const r = await this.q('SELECT `supplyer_name` FROM `kuyou_suppliers` WHERE `id` = ?', [info.customer_id]);
        customerName = r[0]?.supplyer_name || '';
      } else if ([4, 5, 9, 10].includes(bt) && info.customer_id) {
        const r = await this.q('SELECT `customer_name` FROM `kuyou_customers` WHERE `id` = ?', [info.customer_id]);
        customerName = r[0]?.customer_name || '';
      }
      rows.push({
        id: info.id,
        serial: info.serial,
        business_type: info.business_type,
        store_status: info.store_status,
        purchase_time: info.purchase_time,
        createtime: info.createtime,
        purchase_code: info.purchase_code,
        remarks: info.remarks,
        goods_code: gd.goods_code,
        goods_name: gd.goods_name,
        goods_spec: gd.goods_specification_id,
        store_name: st.name,
        customer_id: customerName,
      });
    }
    return { total: this.num(cnt[0]?.total), rows };
  }

  /** 动态过滤列名白名单（仅允许字母数字下划线，防注入） */
  private safeCol(k: string): string {
    return /^[A-Za-z0-9_]+$/.test(String(k)) ? String(k) : 'id';
  }

  /** 参数校验：未知对账类型直接拒绝，避免拼错表名 */
  ensureKind(kind: string): 'customers' | 'suppliers' {
    if (kind === 'customers' || kind === 'suppliers') return kind;
    throw new BadRequestException('不支持的对账单类型');
  }
}
