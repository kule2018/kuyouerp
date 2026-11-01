import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { TABLE_META } from '../../../table-meta';
import { INIT_TABLES, INIT_SETS } from './special.config';

/** 数值兜底：非数字一律按 0 处理 */
function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 按指定小数位四舍五入 */
function round(v: number, digits: number): number {
  const f = Math.pow(10, Math.max(0, Math.min(8, Number(digits) || 0)));
  return Math.round(v * f) / f;
}

/**
 * 专项业务服务：通用 CRUD / 单据引擎覆盖不到的「有计算逻辑」的页面
 *
 * 对应原 kuyou 六个独立控制器，均为「读多张表 → 计算 → 落库」的重逻辑：
 *  1) MRP 计算      Mrps.php          生产计划 → BOM 展开 → 扣除库存 → 生成物料需求
 *  2) 智能补货      Replenishment.php 销量 + 安全库存 - 现有库存 - 在途采购 = 建议采购量
 *  3) 已销订购看板  Purchaseby.php    销售订单的发货/采购下单状态跟踪
 *  4) 计件/计时工资 Wages*.php        验收数量 × 工序单价 / 工时 × 工时单价
 *  5) 结账反结账    Checkout.php      期末成本快照 + 销售成本回填
 *  6) 系统初始化    Initialization.php 清空业务表并恢复系统参数
 *
 * 安全：表名/列名来自代码常量与 TABLE_META 白名单，用户输入一律参数化。
 */
@Injectable()
export class SpecialService {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  /** 校验表在白名单内（初始化批量删表场景） */
  private assertTable(table: string): void {
    if (!TABLE_META[table]) throw new BadRequestException(`表不存在或未授权: ${table}`);
  }

  /**
   * 读取系统设置项
   * @param name kuyou_sets.name
   * @returns { value, is_checked }，不存在时返回空串与 0
   */
  private async getSet(name: string): Promise<{ value: string; is_checked: number }> {
    const rows = await this.conn.query(
      'SELECT `value`, `is_checked` FROM `kuyou_sets` WHERE `name` = ? LIMIT 1',
      [name],
    );
    return { value: rows[0]?.value ?? '', is_checked: Number(rows[0]?.is_checked ?? 0) };
  }

  /**
   * 把日期/时间字符串转秒级时间戳（本地时区）
   * @param v      形如 '2026-01-31' 或 '2026-01-31 12:00:00'
   * @param endDay 是否补齐到当日 23:59:59
   */
  private toSeconds(v: string, endDay = false): number {
    const s = endDay && v.length === 10 ? `${v} 23:59:59` : v;
    const ms = Date.parse(s.replace(' ', 'T'));
    return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
  }

  /* ==================================================================
   * 1) MRP 物料需求计算
   * ================================================================== */

  /**
   * 可选的生产计划明细行（供前端勾选后再计算）
   * @param purchaseCode 生产计划单号（kuyou_plan.purchase_code）
   * @returns 计划明细行数组
   */
  async planLines(purchaseCode: string) {
    if (!purchaseCode) throw new BadRequestException('请选择生产计划单号');
    const plans = await this.conn.query(
      'SELECT * FROM `kuyou_plan` WHERE `purchase_code` = ? LIMIT 1',
      [purchaseCode],
    );
    if (!plans[0]) throw new NotFoundException('生产计划不存在');
    const lines = await this.conn.query(
      'SELECT * FROM `kuyou_plan_info` WHERE `plan_id` = ? ORDER BY `id` ASC',
      [plans[0].id],
    );
    return { plan: plans[0], lines };
  }

  /**
   * MRP 计算：按生产计划展开 BOM，扣除现有库存后得出需采购量
   *
   * 整体思路（对齐原 Mrps.php add()）：
   *  1) 取生产计划主表与勾选的计划明细行
   *  2) 对每行的产成品，按 goods_code 找到 BOM，再取其全部子件（bom_info）
   *  3) 子件用量 × 计划产量得到毛需求；money 同口径放大
   *  4) 取子件当前总库存，库存不足时计算净需求：
   *     - 采购单位与基本单位一致：净需求 = 毛需求 - 库存
   *     - 单位不一致：用单位换算率把库存折算到采购单位后再相减
   *  5) 事务内写入 kuyou_mrp（计划快照）与 kuyou_mrp_info（物料需求行）
   *
   * @param body.purchase_code 生产计划单号
   * @param body.info_id       勾选的计划明细行 id 数组（空表示全部）
   * @param user               当前登录用户
   * @returns { id, purchase_code, lines }
   */
  async mrpCompute(body: { purchase_code?: string; info_id?: any[] | string }, user?: any) {
    const purchaseCode = String(body?.purchase_code || '').trim();
    if (!purchaseCode) throw new BadRequestException('请选择生产计划单号');

    const decimal = Number((await this.getSet('number_decimal')).value || 0);
    const now = Math.floor(Date.now() / 1000);
    const adminId = user?.uid ?? user?.id ?? null;

    const plans = await this.conn.query(
      'SELECT * FROM `kuyou_plan` WHERE `purchase_code` = ? LIMIT 1',
      [purchaseCode],
    );
    const plan = plans[0];
    if (!plan) throw new NotFoundException('生产计划不存在');

    // 计划明细行：未传 info_id 表示全部参与计算
    let infoIds: number[] = [];
    if (body?.info_id !== undefined && body?.info_id !== null && String(body.info_id) !== '') {
      infoIds = (Array.isArray(body.info_id) ? body.info_id : String(body.info_id).split(','))
        .map((v) => parseInt(String(v), 10))
        .filter((v) => Number.isFinite(v) && v > 0);
    }
    let lines: any[];
    if (infoIds.length) {
      lines = await this.conn.query(
        `SELECT * FROM \`kuyou_plan_info\` WHERE \`plan_id\` = ? AND \`id\` IN (${infoIds.map(() => '?').join(',')}) ORDER BY \`id\` ASC`,
        [plan.id, ...infoIds],
      );
    } else {
      lines = await this.conn.query(
        'SELECT * FROM `kuyou_plan_info` WHERE `plan_id` = ? ORDER BY `id` ASC',
        [plan.id],
      );
    }
    if (!lines.length) throw new BadRequestException('该生产计划没有可计算的明细行');

    const data: any[] = [];
    for (const line of lines) {
      // BOM：同一货号可能存在多版清单，全部参与展开
      const boms = await this.conn.query('SELECT `id` FROM `kuyou_bom` WHERE `goods_code` = ?', [
        line.goods_code,
      ]);
      const bomIds = boms.map((b: any) => b.id);
      if (!bomIds.length) continue;
      const mats = await this.conn.query(
        `SELECT * FROM \`kuyou_bom_info\` WHERE \`bom_id\` IN (${bomIds.map(() => '?').join(',')}) ORDER BY \`id\` ASC`,
        bomIds,
      );

      for (const mat of mats) {
        // 毛需求：单位用量随计划产量等比放大
        const planQty = num(line.number);
        const needNumber = round(num(mat.number) * planQty, decimal);
        const needBasic = round(num(mat.basic_nmber) * planQty, decimal);
        const needMoney = round(num(mat.money) * planQty, decimal);

        // 现有库存：跨仓库合计
        const stockRows = await this.conn.query(
          'SELECT SUM(`stock`) AS s FROM `kuyou_goods_stock` WHERE `goods_code` = ? AND `deletetime` IS NULL',
          [mat.goods_code],
        );
        let stock = round(num(stockRows[0]?.s), decimal);

        // 净需求：仅当库存小于基本单位需求量时才需要补货
        let buyNumber = 0;
        if (stock < needBasic) {
          if (needNumber === needBasic) {
            // 采购单位 = 基本单位，直接相减
            buyNumber = round(needNumber - stock, decimal);
          } else {
            // 单位不一致：用换算率把库存折算到采购单位口径再相减
            const rate = await this.unitRate(mat.goods_code, mat.unit_id);
            if (rate) {
              stock = round(stock / rate, decimal);
              buyNumber = round(needNumber - stock, decimal);
            }
          }
        }

        data.push({
          goods_id: mat.goods_id ?? null,
          goods_code: mat.goods_code,
          goods_name: mat.goods_name,
          goods_note: mat.goods_note ?? '',
          unit_id: mat.unit_id ?? null,
          default_unit: mat.default_unit ?? null,
          purchase: mat.purchase ?? null,
          number: needNumber,
          basic_nmber: needBasic,
          stock,
          buy_number: buyNumber,
          money: needMoney,
          remark: mat.remark ?? '',
        });
      }
    }

    return this.conn.transaction(async (em) => {
      // 主表：复制生产计划快照（去掉主键，重置审核与 MRP 状态）
      const header = {
        purchase_code: plan.purchase_code,
        purchase_time: plan.purchase_time,
        delivery_time: plan.delivery_time,
        workshop_id: plan.workshop_id,
        goods_name: plan.goods_name,
        goods_code: plan.goods_code,
        goods_unit: plan.goods_unit,
        default_unit: plan.default_unit,
        number: plan.number,
        basic_nmber: plan.basic_nmber,
        unit_price: plan.unit_price,
        all_money: plan.all_money,
        examine_status: 0,
        examine_time: 0,
        status: 0,
        remark: plan.remark,
        preparation_id: adminId,
        examine_id: 0,
        operation_id: 0,
        mrp_status: 1,
        createtime: now,
        updatetime: now,
      };
      const cols = Object.keys(header).filter((c) => TABLE_META['kuyou_mrp'].columns.includes(c));
      const ins = await em.query(
        `INSERT INTO \`kuyou_mrp\` (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
        cols.map((c) => (header as any)[c]),
      );
      const mrpId = ins.insertId;

      // 明细行：逐行写入物料需求
      for (const d of data) {
        const lineCols = Object.keys(d).filter((c) => TABLE_META['kuyou_mrp_info'].columns.includes(c));
        await em.query(
          `INSERT INTO \`kuyou_mrp_info\` (\`plan_id\`, ${lineCols.map((c) => `\`${c}\``).join(', ')}, \`createtime\`, \`updatetime\`) VALUES (?, ${lineCols.map(() => '?').join(', ')}, ?, ?)`,
          [mrpId, ...lineCols.map((c) => d[c]), now, now],
        );
      }
      return { id: mrpId, purchase_code: plan.purchase_code, lines: data.length };
    });
  }

  /**
   * 单位换算率：把基本单位库存折算为采购单位数量
   * @param goodsCode 商品货号
   * @param viceUnit  明细上的采购单位 id
   * @returns 换算率（>0 有效）；无换算关系返回 0
   */
  private async unitRate(goodsCode: string, viceUnit: any): Promise<number> {
    const goodsRows = await this.conn.query(
      'SELECT `unit_id` FROM `kuyou_goods` WHERE `goods_code` = ? LIMIT 1',
      [goodsCode],
    );
    const mainUnit = goodsRows[0]?.unit_id;
    if (!mainUnit || !viceUnit) return 0;
    const rows = await this.conn.query(
      'SELECT `advance_rate` FROM `kuyou_unit_conversion` WHERE `main_unit` = ? AND `vice_unit` = ? LIMIT 1',
      [mainUnit, viceUnit],
    );
    return num(rows[0]?.advance_rate);
  }

  /**
   * MRP 列表 + 明细查看
   * @param q.offset / q.limit 分页
   */
  async mrpList(q: any) {
    const offset = Math.max(0, parseInt(String(q?.offset ?? 0), 10) || 0);
    const limit = Math.min(500, parseInt(String(q?.limit ?? 15), 10) || 15);
    const rows = await this.conn.query(
      'SELECT * FROM `kuyou_mrp` ORDER BY `id` DESC LIMIT ?, ?',
      [offset, limit],
    );
    const totalRows = await this.conn.query('SELECT COUNT(*) AS total FROM `kuyou_mrp`');
    return { total: Number(totalRows[0]?.total || 0), rows };
  }

  /**
   * MRP 明细
   * @param id kuyou_mrp 主键
   */
  async mrpDetail(id: number) {
    const headers = await this.conn.query('SELECT * FROM `kuyou_mrp` WHERE `id` = ? LIMIT 1', [id]);
    if (!headers[0]) throw new NotFoundException('MRP 记录不存在');
    const lines = await this.conn.query(
      'SELECT * FROM `kuyou_mrp_info` WHERE `plan_id` = ? ORDER BY `id` ASC',
      [id],
    );
    return { header: headers[0], lines };
  }

  /* ==================================================================
   * 2) 智能补货
   * ================================================================== */

  /**
   * 智能补货：按销售订单统计需求量，结合安全库存与在途采购给出建议采购量
   *
   * 计算公式：建议采购量 = 销售需求量 + 最低库存 - 现有库存 - 在途采购量（小于 0 取 0）
   *
   * @param q.start_time / q.end_time 销售订单时间区间（YYYY-MM-DD）
   * @param q.offset / q.limit        分页
   */
  async replenishment(q: any) {
    const start = q?.start_time ? this.toSeconds(String(q.start_time)) : 0;
    const end = q?.end_time ? this.toSeconds(String(q.end_time), true) : 0;
    const offset = Math.max(0, parseInt(String(q?.offset ?? 0), 10) || 0);
    const limit = Math.min(500, parseInt(String(q?.limit ?? 50), 10) || 50);
    const decimal = Number((await this.getSet('number_decimal')).value || 0);

    // 1) 区间内有销售需求的商品 + 属性组合（去重）
    let baseSql = 'SELECT `goods_code`, `goods_attr` FROM `kuyou_goods_sales_order_info`';
    const params: any[] = [];
    if (start && end) {
      baseSql += ' WHERE `purchase_time` BETWEEN ? AND ?';
      params.push(start, end);
    }
    baseSql += ' GROUP BY `goods_code`, `goods_attr`';
    const combos = await this.conn.query(baseSql, params);

    const rows: any[] = [];
    for (const c of combos) {
      const goodsRows = await this.conn.query(
        'SELECT `id`, `goods_code`, `goods_name`, `unit_id`, `purchase` FROM `kuyou_goods` WHERE `goods_code` = ? LIMIT 1',
        [c.goods_code],
      );
      const goods = goodsRows[0];
      if (!goods) continue;

      // 最低安全库存（多仓预警设置合计）
      const warnRows = await this.conn.query(
        'SELECT SUM(`min_stock`) AS m FROM `kuyou_goods_stock_warning` WHERE `goods_code` = ?',
        [c.goods_code],
      );
      const minStock = num(warnRows[0]?.m);

      // 现有库存
      const stockRows = await this.conn.query(
        'SELECT SUM(`stock`) AS s FROM `kuyou_goods_stock` WHERE `goods_code` = ? AND `deletetime` IS NULL',
        [c.goods_code],
      );
      const stock = num(stockRows[0]?.s);

      // 销售需求量 / 采购在途量（同一时间口径）
      const attrFilter = c.goods_attr ? ' AND `goods_attr` = ?' : '';
      const saleRows = await this.conn.query(
        `SELECT SUM(\`basic_nmber\`) AS n FROM \`kuyou_goods_sales_order_info\` WHERE \`goods_code\` = ?${attrFilter}${
          start && end ? ' AND `purchase_time` BETWEEN ? AND ?' : ''
        }`,
        [c.goods_code, ...(c.goods_attr ? [c.goods_attr] : []), ...(start && end ? [start, end] : [])],
      );
      const purRows = await this.conn.query(
        `SELECT SUM(\`basic_nmber\`) AS n FROM \`kuyou_goods_purchase_order_info\` WHERE \`goods_code\` = ?${attrFilter}${
          start && end ? ' AND `purchase_time` BETWEEN ? AND ?' : ''
        }`,
        [c.goods_code, ...(c.goods_attr ? [c.goods_attr] : []), ...(start && end ? [start, end] : [])],
      );
      const saleQty = num(saleRows[0]?.n);
      const purchaseQty = num(purRows[0]?.n);

      const unitRows = await this.conn.query(
        'SELECT `name` FROM `kuyou_unit` WHERE `id` = ? LIMIT 1',
        [goods.unit_id],
      );

      const suggest = Math.max(0, round(saleQty + minStock - stock - purchaseQty, decimal));
      rows.push({
        goods_id: goods.id,
        goods_code: goods.goods_code,
        goods_name: goods.goods_name,
        goods_attr: c.goods_attr,
        unit_name: unitRows[0]?.name ?? '',
        sale_number: round(saleQty, decimal),
        stock: round(stock, decimal),
        min_stock: round(minStock, decimal),
        purchase_number: round(purchaseQty, decimal),
        suggest_number: suggest,
      });
    }

    // 仅返回需要补货的行更贴合原页，但为便于核对这里保留全部并按建议量倒序
    rows.sort((a, b) => b.suggest_number - a.suggest_number);
    return { total: rows.length, rows: rows.slice(offset, offset + limit) };
  }

  /* ==================================================================
   * 3) 已销订购看板
   * ================================================================== */

  /**
   * 已销订购看板：销售订单的发货与采购下单状态跟踪
   *
   * 每行销售订单明细，回填四类状态：
   *  - 已销数量（销售订单 basic_nmber）
   *  - 已出库数量（关联销货单明细）
   *  - 已订购数量（关联采购订单明细）
   *  - 采购订单审核状态
   *
   * @param q.keyword   货号 / 客户名称关键字
   * @param q.offset / q.limit
   */
  async soldOrdered(q: any) {
    const offset = Math.max(0, parseInt(String(q?.offset ?? 0), 10) || 0);
    const limit = Math.min(500, parseInt(String(q?.limit ?? 15), 10) || 15);
    const kw = String(q?.keyword || '').trim();
    const decimal = Number((await this.getSet('number_decimal')).value || 0);
    const priceDecimal = Number((await this.getSet('price_decimal')).value || 2);

    let sql = 'SELECT * FROM `kuyou_goods_sales_order_info`';
    const params: any[] = [];
    if (kw) {
      sql += ' WHERE (`goods_code` LIKE ? OR `goods_note` LIKE ?)';
      params.push(`%${kw}%`, `%${kw}%`);
    }
    sql += ' ORDER BY `id` DESC LIMIT ?, ?';
    const lines = await this.conn.query(sql, [...params, offset, limit]);

    const rows: any[] = [];
    for (const l of lines) {
      const goodsRows = await this.conn.query(
        'SELECT `id`, `goods_name`, `goods_code` FROM `kuyou_goods` WHERE `goods_code` = ? LIMIT 1',
        [l.goods_code],
      );
      const unitRows = await this.conn.query(
        'SELECT `name` FROM `kuyou_unit` WHERE `id` = ? LIMIT 1',
        [l.goods_unit],
      );
      const storeRows = await this.conn.query(
        'SELECT `name` FROM `kuyou_stores` WHERE `id` = ? LIMIT 1',
        [l.stores_id],
      );
      const custRows = await this.conn.query(
        'SELECT `customer_name` FROM `kuyou_customers` WHERE `id` = ? LIMIT 1',
        [l.customers_id],
      );

      // 已出库：销货单明细按销售订单号关联
      const outRows = await this.conn.query(
        'SELECT SUM(`basic_nmber`) AS n FROM `kuyou_goods_sales_info` WHERE `sales_order_id` = ?',
        [l.purchase_code],
      );
      // 已订购：采购订单明细按销售订单号关联（取单号 + 汇总已下单数量）
      const orderRows = await this.conn.query(
        'SELECT `purchase_code` FROM `kuyou_goods_purchase_order_info` WHERE `sales_order_id` = ? LIMIT 1',
        [l.purchase_code],
      );
      const orderedSumRows = await this.conn.query(
        'SELECT SUM(`number`) AS n FROM `kuyou_goods_purchase_order_info` WHERE `sales_order_id` = ?',
        [l.purchase_code],
      );
      let orderStatus = '';
      if (orderRows[0]) {
        const st = await this.conn.query(
          'SELECT `examine_status` FROM `kuyou_goods_purchase_order` WHERE `purchase_code` = ? LIMIT 1',
          [orderRows[0].purchase_code],
        );
        orderStatus = st[0] ? (Number(st[0].examine_status) === 1 ? '已审核' : '未审核') : '';
      }

      rows.push({
        id: l.id,
        purchase_code: l.purchase_code,
        purchase_time: l.purchase_time,
        goods_code: l.goods_code,
        goods_name: goodsRows[0]?.goods_name ?? '',
        unit_name: unitRows[0]?.name ?? '',
        stores_name: storeRows[0]?.name ?? '',
        customers_name: custRows[0]?.customer_name ?? '',
        sale_number: round(num(l.basic_nmber), decimal),
        out_number: round(num(outRows[0]?.n), decimal),
        sold_number: round(num(orderedSumRows[0]?.n), decimal),
        // 待采购数量 = 销售数量 − already 已下单数量（源 purchaseby 的 buy_number）
        buy_number: round(Math.max(0, num(l.basic_nmber) - num(orderedSumRows[0]?.n)), decimal),
        ordered_code: orderRows[0]?.purchase_code ?? '',
        ordered_status: orderStatus,
        // 生成购货订单所需的行原始字段（源 purchaseby setdata 组包字段）
        goods_attr: l.goods_attr,
        goods_unit: l.goods_unit,
        stores_id: l.stores_id,
        customers_id: l.customers_id,
        unit_price: round(num(l.unit_price), priceDecimal),
      });
    }
    return { total: lines.length, rows };
  }

  /* ==================================================================
   * 4) 计件工资 / 计时工资
   * ================================================================== */

  /**
   * 工资计算（计件 / 计时）
   *
   * 计件：金额 = Σ(验收数量 × BOM 工序单价 wages)
   * 计时：金额 = Σ(工时 work_time × BOM 工序工时单价 hours)
   * 两种口径均按验收单行展开，工序单价取该产成品 BOM 中同名子件的工序设置。
   *
   * @param q.type    'piece' 计件 | 'hour' 计时
   * @param q.offset / q.limit
   */
  async wages(q: any) {
    const type = String(q?.type || 'piece') === 'hour' ? 'hour' : 'piece';
    const offset = Math.max(0, parseInt(String(q?.offset ?? 0), 10) || 0);
    const limit = Math.min(500, parseInt(String(q?.limit ?? 15), 10) || 15);
    const priceDecimal = Number((await this.getSet('price_decimal')).value || 2);

    const list = await this.conn.query(
      'SELECT * FROM `kuyou_acceptance` ORDER BY `id` DESC LIMIT ?, ?',
      [offset, limit],
    );
    const totalRows = await this.conn.query('SELECT COUNT(*) AS total FROM `kuyou_acceptance`');

    const rows: any[] = [];
    for (const a of list) {
      const shopRows = await this.conn.query(
        'SELECT `name` FROM `kuyou_workshop` WHERE `id` = ? LIMIT 1',
        [a.workshop_id],
      );
      const staffRows = await this.conn.query(
        'SELECT `men_code`, `name` FROM `kuyou_staff_member` WHERE `id` = ? LIMIT 1',
        [a.work_id],
      );
      // 验收明细：本次实际合格的品种与数量
      const infos = await this.conn.query(
        'SELECT `goods_code`, `number` FROM `kuyou_acceptance_info` WHERE `production_id` = ?',
        [a.id],
      );

      let amount = 0;
      for (const info of infos) {
        const bomRows = await this.conn.query(
          'SELECT `id` FROM `kuyou_bom` WHERE `goods_code` = ? LIMIT 1',
          [info.goods_code],
        );
        if (!bomRows[0]) continue;
        const procRows = await this.conn.query(
          'SELECT SUM(`wages`) AS w, SUM(`hours`) AS h FROM `kuyou_bom_procedure` WHERE `bom_id` = ?',
          [bomRows[0].id],
        );
        if (type === 'piece') {
          amount += num(info.number) * num(procRows[0]?.w);
        } else {
          amount += num(a.work_time) * num(procRows[0]?.h);
        }
      }

      rows.push({
        id: a.id,
        code: a.code ?? a.purchase_code,
        acceptance_code: a.purchase_code,
        purchase_time: a.purchase_time,
        workshop_name: shopRows[0]?.name ?? '',
        staff_code: staffRows[0]?.men_code ?? '',
        staff_name: staffRows[0]?.name ?? '',
        work_time: num(a.work_time),
        finish_number: num(a.finish_number),
        examine_status: a.examine_status,
        wages: round(amount, priceDecimal),
      });
    }
    return { total: Number(totalRows[0]?.total || 0), rows };
  }

  /* ==================================================================
   * 5) 结账 / 反结账
   * ================================================================== */

  /**
   * 结账状态：系统启用日期、上次结账日期
   * @returns { enable_time, last_checkdate, last_checktime }
   */
  async checkoutStatus() {
    const enable = await this.getSet('enable_time');
    const last = await this.conn.query(
      'SELECT `id`, `checkdate`, `checktime` FROM `kuyou_checkout` ORDER BY `checktime` DESC LIMIT 1',
    );
    return {
      enable_time: enable.value,
      last_id: last[0]?.id ?? 0,
      last_checkdate: last[0]?.checkdate ?? '',
      last_checktime: Number(last[0]?.checktime ?? 0),
    };
  }

  /**
   * 期末结账
   *
   * 整体思路（对齐 Checkout.php checkout()）：
   *  1) 校验：结账日期不得早于系统启用日期、不得早于上次结账日期
   *  2) 成本快照：对每个商品取「截至结账日」的最新进价记录，
   *     分别按移动平均(valuation=1)与先进先出(valuation=2)两种口径给出数量与金额
   *  3) 回填销售成本：区间内的销售利润行按批次/加权成本计算 sales_cost
   *  4) 事务写入 kuyou_checkout（本次结账）与 kuyou_checkout_info（成本快照）
   *
   * @param body.checkdate 结账日期 YYYY-MM-DD
   * @param user           当前用户
   * @returns { id, checkdate, snapshotted, profit_updated }
   */
  async checkout(body: { checkdate?: string }, user?: any) {
    const raw = String(body?.checkdate || '').trim();
    if (!raw) throw new BadRequestException('请选择结账日期');
    const date = raw.slice(0, 10);
    const checktime = this.toSeconds(date);

    const enable = await this.getSet('enable_time');
    const enableTime = this.toSeconds(String(enable.value || '').slice(0, 10));
    if (enableTime && enableTime > checktime) {
      throw new BadRequestException(`结账日期不能小于系统启用日期：${enable.value}`);
    }

    const lastRows = await this.conn.query(
      'SELECT `checkdate`, `checktime` FROM `kuyou_checkout` ORDER BY `checktime` DESC LIMIT 1',
    );
    const last = lastRows[0];
    if (last && Number(last.checktime) >= checktime) {
      throw new BadRequestException(`结账日期不能小于等于上次结账日期：${last.checkdate}`);
    }
    // 本期起点：上次结账次日，首次则为系统启用日
    const startTime = last ? Number(last.checktime) + 1 : enableTime;
    const valuation = Number((await this.getSet('valuation')).value || 1);
    const now = Math.floor(Date.now() / 1000);
    const adminId = user?.uid ?? user?.id ?? null;

    // 参与库存计价的全部商品
    const goodsList = await this.conn.query(
      "SELECT `id`, `goods_code`, `goods_name`, `unit_id` FROM `kuyou_goods` WHERE `status` = '1'",
    );

    const info: any[] = [];
    for (const g of goodsList) {
      // 先进先出口径：截至结账日的最后一笔进货
      const fifo = await this.conn.query(
        'SELECT `id`, `basic_nmber`, `all_money`, `purchase_time` FROM `kuyou_goods_purchase_info` WHERE `goods_code` = ? AND `purchase_time` <= ? ORDER BY `purchase_time` ASC, `purchase_code` ASC',
        [g.goods_code, checktime],
      );
      const tail = fifo[fifo.length - 1];

      // 移动平均口径：本期全部进货按天汇总后的加权均价
      const avgRows = await this.conn.query(
        'SELECT SUM(`basic_nmber`) AS n, SUM(`all_money`) AS m FROM `kuyou_goods_purchase_info` WHERE `goods_code` = ? AND `purchase_time` BETWEEN ? AND ?',
        [g.goods_code, startTime, checktime],
      );

      info.push({
        goods_id: g.id,
        goods_code: g.goods_code,
        basic_nmber: num(tail?.basic_nmber),
        all_money: num(tail?.all_money),
        purchase_id: tail?.id ?? 0,
        purchase_time: tail?.purchase_time ?? null,
        av_basic_nmber: num(avgRows[0]?.n),
        av_all_money: num(avgRows[0]?.m),
      });
    }

    // 销售成本回填：本期内的销售利润行，按选定计价法算出成本
    const profitRows = await this.conn.query(
      'SELECT `id`, `purchase_code`, `purchase_time`, `purchase_type` FROM `kuyou_goods_sales_profit` WHERE `purchase_time` BETWEEN ? AND ?',
      [startTime + 1, checktime],
    );
    let profitUpdated = 0;
    for (const p of profitRows) {
      const cost = await this.salesCost(p.purchase_code, checktime, startTime, valuation);
      if (cost > 0) {
        await this.conn.query('UPDATE `kuyou_goods_sales_profit` SET `sales_cost` = ? WHERE `id` = ?', [
          cost,
          p.id,
        ]);
        profitUpdated++;
      }
    }

    return this.conn.transaction(async (em) => {
      const ins = await em.query(
        'INSERT INTO `kuyou_checkout` (`checkdate`, `checktime`, `preparation_id`, `preparation_time`, `createtime`, `updatetime`) VALUES (?, ?, ?, ?, ?, ?)',
        [date, checktime, adminId, now, now, now],
      );
      const checkoutId = ins.insertId;
      for (const row of info) {
        await em.query(
          'INSERT INTO `kuyou_checkout_info` (`checkout_id`, `goods_id`, `goods_code`, `basic_nmber`, `all_money`, `purchase_id`, `purchase_time`, `av_basic_nmber`, `av_all_money`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            checkoutId,
            row.goods_id,
            row.goods_code,
            row.basic_nmber,
            row.all_money,
            row.purchase_id,
            row.purchase_time,
            row.av_basic_nmber,
            row.av_all_money,
          ],
        );
      }
      return { id: checkoutId, checkdate: date, snapshotted: info.length, profit_updated: profitUpdated };
    });
  }

  /**
   * 单张单据的销售成本
   * @param purchaseCode 销货单号
   * @param endTime      结账时点（不晚于此)
   * @param startTime    本期起点
   * @param valuation    1=移动平均 2=先进先出
   * @returns 该单的合计销售成本
   */
  private async salesCost(
    purchaseCode: string,
    endTime: number,
    startTime: number,
    valuation: number,
  ): Promise<number> {
    const lines = await this.conn.query(
      'SELECT `goods_code`, `basic_nmber` FROM `kuyou_goods_sales_info` WHERE `purchase_code` = ?',
      [purchaseCode],
    );
    let total = 0;
    for (const l of lines) {
      const qty = num(l.basic_nmber);
      if (!qty) continue;
      if (valuation === 2) {
        // 先进先出：按进货顺序逐笔消耗，最后一笔的部分出库按该笔单价计
        const buys = await this.conn.query(
          'SELECT `basic_nmber`, `all_money` FROM `kuyou_goods_purchase_info` WHERE `goods_code` = ? AND `purchase_time` <= ? ORDER BY `purchase_time` ASC, `purchase_code` ASC',
          [l.goods_code, endTime],
        );
        let remain = qty;
        for (const b of buys) {
          if (remain <= 0) break;
          const bq = num(b.basic_nmber);
          const bm = num(b.all_money);
          const take = Math.min(remain, bq);
          if (bq > 0) total += (bm / bq) * take;
          remain -= take;
        }
        // 进货不足覆盖出库量时，剩余部分按最新进价兜底
        if (remain > 0 && buys.length) {
          const last = buys[buys.length - 1];
          const bq = num(last.basic_nmber);
          if (bq > 0) total += (num(last.all_money) / bq) * remain;
        }
      } else {
        // 移动平均：本期进货总金额 / 总数量 = 单位成本
        const rows = await this.conn.query(
          'SELECT SUM(`basic_nmber`) AS n, SUM(`all_money`) AS m FROM `kuyou_goods_purchase_info` WHERE `goods_code` = ? AND `purchase_time` BETWEEN ? AND ?',
          [l.goods_code, startTime, endTime],
        );
        const n = num(rows[0]?.n);
        if (n > 0) total += (num(rows[0]?.m) / n) * qty;
      }
    }
    return total;
  }

  /**
   * 反结账：删除最后一次结账记录及其成本快照
   * @returns { removed, checkdate }
   */
  async uncheckout() {
    const last = await this.conn.query(
      'SELECT `id`, `checkdate` FROM `kuyou_checkout` ORDER BY `checktime` DESC LIMIT 1',
    );
    if (!last[0]) throw new BadRequestException('暂无结账记录，无法反结账');
    const id = last[0].id;
    return this.conn.transaction(async (em) => {
      await em.query('DELETE FROM `kuyou_checkout_info` WHERE `checkout_id` = ?', [id]);
      await em.query('DELETE FROM `kuyou_checkout` WHERE `id` = ?', [id]);
      return { removed: id, checkdate: last[0].checkdate };
    });
  }

  /* ==================================================================
   * 6) 系统初始化
   * ================================================================== */

  /**
   * 系统初始化：清空全部业务表并把系统参数恢复为出厂默认值
   *
   * 注意：这是不可逆操作，事务执行；清空范围与顺序与原 Initialization.php 一致。
   * @param body.confirm 必须为 'INITIALIZE' 才执行，防止误触
   * @returns { tables, sets }
   */
  async initialization(body: { confirm?: string }) {
    if (String(body?.confirm || '') !== 'INITIALIZE') {
      throw new BadRequestException('请确认初始化操作：confirm=INITIALIZE');
    }
    // 逐表校验白名单，避免硬编码表名拼 SQL 造成注入风险
    for (const t of INIT_TABLES) this.assertTable(t);

    return this.conn.transaction(async (em) => {
      // 1) 恢复系统参数为默认值
      for (const s of INIT_SETS) {
        await em.query('UPDATE `kuyou_sets` SET `value` = ?, `is_checked` = ? WHERE `name` = ?', [
          s.value,
          s.is_checked,
          s.name,
        ]);
      }
      // 2) 清空业务表
      let tables = 0;
      for (const t of INIT_TABLES) {
        await em.query(`DELETE FROM \`${t}\``);
        tables++;
      }
      return { tables, sets: INIT_SETS.length };
    });
  }
}
