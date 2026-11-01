import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

/**
 * 汇总报表服务（1:1 还原源 GoodsPurchaseSummarys / GoodsSalesSummarys / GoodsSalesSummaryc）
 *
 * 整体思路（三张报表结构完全同构，仅「往来维度」与「汇总表」不同）：
 *  1) 先取往来方列表（供应商 / 业务员 / 客户），逐个作为过滤条件；
 *  2) 对汇总表（`kuyou_goods_purchase_summary` 或 `kuyou_goods_sales_summary`）按
 *     「商品 + 仓库」分组聚合，join 商品/仓库/单位取名称；
 *  3) 计算单位换算串（多单位商品形如 箱(1:12)，单单位固定 1）；
 *  4) 把每个往来方的明细压平进 listarr，并按维度值分段输出「小计」，最后补一行「合计」。
 *
 * 实现说明：源端用 ANY_VALUE + GROUP BY，且每个往来方单独查一次（N+1）；这里保持同样的
 * 分组口径，但把单位换算与名称回发放到一次批量查询里完成。
 */
/**
 * 汇总口径：按供应商 / 业务员 / 客户
 * - purchase_supplier：采购汇总，取 `kuyou_goods_purchase_summary` 且 purchase_type=1
 * - sale_user：销货汇总按业务员，取 `kuyou_goods_sales_summary` 的 sale_user
 * - sale_customer：销货汇总按客户，取 `kuyou_goods_sales_summary` 的 customers_id
 */
export type SummaryKind = 'purchase_supplier' | 'sale_user' | 'sale_customer';

@Injectable()
export class SummaryService {  constructor(@InjectConnection() private readonly conn: Connection) {}

  /** 执行查询（占位符 ?） */
  private async q(sql: string, params: any[] = []): Promise<any[]> {
    const r = await this.conn.query(sql, params);
    return Array.isArray(r) ? r : [];
  }

  private num(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /** 按小数位四舍五入 */
  private round(v: number, dec: number): number {
    const p = Math.pow(10, Math.max(0, Math.min(8, Number(dec) || 0)));
    return Math.round(v * p) / p;
  }

  /** 读取系统设置（按 name 建索引） */
  private async sets(): Promise<Record<string, any>> {
    const rows = await this.q('SELECT `type`, `name`, `value`, `is_checked`, `set` FROM `kuyou_sets`');
    const out: Record<string, any> = {};
    for (const v of rows) out[v.name] = v;
    return out;
  }

  /**
   * 汇总报表统一入口
   * @param kind   purchase_supplier = 采购汇总（按供应商）
   *               sale_user        = 销货汇总（按业务员）
   *               sale_customer    = 销货汇总（按客户）
   * @param filter 前端 filter（JSON 字符串或对象）
   * @param field  分段字段（分组依据列），默认分别为 supplyer_code / staff_member_id / customers_id
   * @param order  排序方向
   */
  async run(kind: SummaryKind, filter: any, field?: string, order?: string) {
    const set = await this.sets();
    const nd = this.num(set['number_decimal']?.value);
    const pd = this.num(set['price_decimal']?.value);

    /* ---------- filter 解析（与源一致：id 小于 / 时间区间 BETWEEN / 其余 LIKE） ---------- */
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
    const conds: string[] = [];
    const ps: any[] = [];
    for (const k of Object.keys(f)) {
      const v = f[k];
      if (v === '' || v === null || v === undefined) continue;
      if (k === 'id') {
        conds.push('i.`id` < ?');
        ps.push(this.num(v));
      } else if (String(v).indexOf(' - ') >= 0 && k.indexOf('time') >= 0) {
        const arr = String(v).split(' - ');
        conds.push('i.`' + this.safeCol(k) + '` BETWEEN ? AND ?');
        ps.push(Math.floor(new Date(String(arr[0]).trim()).getTime() / 1000));
        ps.push(Math.floor(new Date(String(arr[1]).trim()).getTime() / 1000));
      } else {
        conds.push('i.`' + this.safeCol(k) + '` LIKE ?');
        ps.push(`%${v}%`);
      }
    }
    const whereSql = conds.length ? ' WHERE ' + conds.join(' AND ') : '';
    const orderDir = String(order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    /* ---------- 往来方列表 ---------- */
    const parties = await this.parties(kind, f, ps);

    /* ---------- 逐个往来方取分组聚合 ---------- */
    const listarr: any[] = [];
    for (const party of parties) {
      const rows = await this.aggregate(kind, whereSql, ps, party);
      for (const r of rows) {
        const conv = await this.unitConversion(r, nd, pd);
        listarr.push(conv);
      }
    }

    /* ---------- 分段小计 + 总计 ---------- */
    const segField = field || this.defaultField(kind);
    return this.withSubtotals(listarr, segField, kind, nd, pd);
  }

  /** 三类报表的默认分段字段 */
  private defaultField(kind: SummaryKind): string {
    if (kind === 'purchase_supplier') return 'supplyer_code';
    if (kind === 'sale_user') return 'staff_member_id';
    return 'customers_id';
  }

  /**
   * 取往来方列表
   * - purchase_supplier：供应商 join 供应商类型，可按 supplyer_code LIKE 过滤
   * - sale_user：职员（含工号）
   * - sale_customer：客户 join 客户类型
   */
  private async parties(kind: SummaryKind, f: any, ps: any[]): Promise<any[]> {
    if (kind === 'sale_user') {
      return this.q('SELECT `id`, `name`, `men_code` FROM `kuyou_staff_member`');
    }
    if (kind === 'purchase_supplier') {
      const w: string[] = [];
      const p: any[] = [];
      if (f.supplyer_code) {
        w.push('sp.`supplyer_code` LIKE ?');
        p.push(`%${f.supplyer_code}%`);
      }
      return this.q(
        'SELECT sp.`id`, sp.`supplyer_code`, sp.`supplyer_name`, gt.`supplier_type_name` ' +
          'FROM `kuyou_suppliers` sp LEFT JOIN `kuyou_supplyertype` gt ON sp.`supplyertype_id` = gt.`id`' +
          (w.length ? ' WHERE ' + w.join(' AND ') : ''),
        p,
      );
    }
    return this.q(
      'SELECT sp.`id`, sp.`customer_code`, sp.`customer_name`, gt.`type_name` ' +
        'FROM `kuyou_customers` sp LEFT JOIN `kuyou_customertype` gt ON sp.`customertype_id` = gt.`id`',
    );
  }

  /**
   * 按「商品 + 仓库」分组聚合汇总表
   * 与源端 select 字段一致：金额类求和，名称类 ANY_VALUE。
   */
  private async aggregate(kind: SummaryKind, whereSql: string, ps: any[], party: any): Promise<any[]> {
    const isPurchase = kind === 'purchase_supplier';
    const table = isPurchase ? 'kuyou_goods_purchase_summary' : 'kuyou_goods_sales_summary';
    // 往来过滤列：采购按供应商编码、业务员按职员 id、客户按客户 id
    let partyCond = '';
    const partyParams: any[] = [];
    if (isPurchase) {
      partyCond = 'i.`supplyer_code` = ?';
      partyParams.push(party.supplyer_code);
    } else if (kind === 'sale_user') {
      partyCond = 'i.`sale_user` = ?';
      partyParams.push(party.id);
    } else {
      partyCond = 'i.`customers_id` = ?';
      partyParams.push(party.id);
    }
    if (isPurchase) {
      // 源端固定只看 purchase_type=1（普通采购）
      partyCond = '( ' + partyCond + ' ) AND i.`purchase_type` = 1';
    }

    const rows = await this.q(
      'SELECT SUM(i.`tax_money`) AS `tax_money`, SUM(i.`money_tax_price`) AS `money_tax_price`, ' +
        'SUM(i.`basic_nmber`) AS `basic_nmber`, SUM(i.`number`) AS `i_number`, SUM(i.`all_money`) AS `all_money`, ' +
        'ANY_VALUE(i.`unit_price`) AS `unit_price`, ANY_VALUE(i.`default_unit`) AS `default_unit`, ' +
        'ANY_VALUE(i.`goods_unit`) AS `goods_unit`, ANY_VALUE(i.`purchase_money`) AS `purchase_money`, ' +
        'ANY_VALUE(i.`stores_id`) AS `stores_id`, ' +
        'ANY_VALUE(g.`goods_code`) AS `goods_code`, ANY_VALUE(g.`goods_name`) AS `goods_name`, ' +
        'ANY_VALUE(g.`goods_specification_id`) AS `goods_specification_id`, ANY_VALUE(g.`goods_barcode`) AS `goods_barcode`, ' +
        'ANY_VALUE(g.`unit_id`) AS `unit_id`, ANY_VALUE(g.`more_unit`) AS `more_unit`, ' +
        'ANY_VALUE(s.`name`) AS `s_name`, ANY_VALUE(u.`name`) AS `u_name` ' +
        `FROM \`${table}\` i ` +
        'LEFT JOIN `kuyou_goods` g ON g.`goods_code` = i.`goods_code` ' +
        'LEFT JOIN `kuyou_stores` s ON s.`id` = i.`stores_id` ' +
        'LEFT JOIN `kuyou_unit` u ON u.`id` = i.`goods_unit` ' +
        (whereSql ? whereSql + ' AND ' : ' WHERE ') +
        partyCond +
        ' GROUP BY i.`goods_code`, i.`stores_id`',
      [...ps, ...partyParams],
    );

    // 商品名回填 + 单位换算串 + 往来方名称
    const unitIds = rows.map((r: any) => r.unit_id).filter(Boolean);
    const unitName: Record<string, any> = {};
    if (unitIds.length) {
      const ph = unitIds.map(() => '?').join(',');
      const us = await this.q(`SELECT \`id\`, \`name\` FROM \`kuyou_unit\` WHERE \`id\` IN (${ph})`, unitIds);
      for (const u of us) unitName[u.id] = u;
    }
    return rows.map((r: any) => {
      const out: any = { ...r };
      out.i_number = this.num(r.basic_nmber); // 源端口径：汇总数量取基本数量
      out.unit_name = unitName[r.unit_id]?.name || r.u_name || '';
      out.party = party;
      out.unit_conversion = 1;
      return out;
    });
  }

  /**
   * 计算单位换算串（对应源端 more_unit / unit_conversion 逻辑）
   * - 单单位商品：unit_conversion = 1
   * - 多单位商品：unit_conversion = 1,箱:12 形式串（便于前端展示），并带出当前行的换算率
   */
  private async unitConversion(row: any, nd: number, pd: number): Promise<any> {
    const out: any = { ...row };
    if (this.num(row.more_unit) !== 1) {
      out.unit_conversion = 1;
      return out;
    }
    const unit = (await this.q('SELECT `id`, `name` FROM `kuyou_unit` WHERE `id` = ?', [row.unit_id]))[0];
    if (!unit) {
      out.unit_conversion = 1;
      return out;
    }
    out.u_name = unit.name;
    const more = await this.q(
      'SELECT uc.`vice_unit`, u.`name`, u.`id`, uc.`advance_rate` ' +
        'FROM `kuyou_unit_conversion` uc LEFT JOIN `kuyou_unit` u ON u.`id` = uc.`vice_unit` ' +
        'WHERE uc.`main_unit` = ? ORDER BY uc.`advance_rate` ASC',
      [unit.id],
    );
    let unitName = unit.name;
    let rate = '1';
    for (const m of more) {
      unitName += ',' + m.name;
      rate += ':' + m.advance_rate;
      if (String(m.id) === String(row.goods_unit)) {
        out.advance_rate = this.num(m.advance_rate);
        out.more_unit_name = m.name;
      }
    }
    out.unit_conversion = unitName + '(' + rate + ')';
    return out;
  }

  /**
   * 分段小计 + 总计（1:1 还原源端 $data / $counts 逻辑）
   * 当分段字段值变化时输出一行「小计」，最后补一行「合计」。
   */
  private withSubtotals(listarr: any[], field: string, kind: SummaryKind, nd: number, pd: number) {
    if (!listarr.length) return { total: 0, rows: [] };
    // 每行打上维度值（源端在循环里赋 $list_v[$field]）
    for (const r of listarr) {
      const party = r.party || {};
      if (kind === 'purchase_supplier') {
        r[field] = party.supplyer_code;
        r.supplyer_name = party.supplyer_name;
        r.supplier_type_name = party.supplier_type_name;
      } else if (kind === 'sale_user') {
        r[field] = party.id;
        r.supplyer_name = party.name;
        r.supplier_type_name = party.men_code;
      } else {
        r[field] = party.id;
        r.supplyer_name = party.customer_name;
        r.supplier_type_name = party.type_name;
      }
    }

    const countKeys = ['i_number', 'unit_price', 'all_money', 'tax_included', 'tax_money', 'money_tax_price'];
    const data: any[] = [];
    const now0 = listarr[0][field];
    if (!now0 && now0 !== 0) return { total: 0, rows: [] };

    let cur = this.zeroCount(countKeys);
    const total = this.zeroCount(countKeys);
    let seg = listarr[0][field];

    const pushSub = () => {
      const row: any = { ...cur };
      row.s_name = '小计';
      row.unit_price = cur.i_number > 0 ? this.round(cur.all_money / cur.i_number, pd) : 0;
      row.i_number = this.round(cur.i_number, nd);
      row.unit_price = this.round(row.unit_price, pd);
      row.all_money = this.round(cur.all_money, pd);
      row.tax_money = this.round(cur.tax_money, pd);
      row.money_tax_price = this.round(cur.money_tax_price, pd);
      data.push(row);
    };

    listarr.forEach((v: any, k: number) => {
      if (v[field] !== seg) {
        pushSub();
        seg = v[field];
        cur = this.zeroCount(countKeys);
      }
      for (const key of countKeys) {
        cur[key] += this.num(v[key]);
        total[key] += this.num(v[key]);
      }
      v.i_number = this.round(this.num(v.i_number), nd);
      v.unit_price = this.round(this.num(v.unit_price), pd);
      v.all_money = this.round(this.num(v.all_money), pd);
      v.tax_money = this.round(this.num(v.tax_money), pd);
      v.money_tax_price = this.round(this.num(v.money_tax_price), pd);
      data.push(v);
      if (k === listarr.length - 1) pushSub();
    });

    total.s_name = '合计';
    total.unit_price = total.i_number > 0 ? this.round(total.all_money / total.i_number, pd) : 0;
    total.tax_included = this.round(this.num(total.tax_included), pd);
    total.all_money = this.round(total.all_money, pd);
    total.tax_money = this.round(total.tax_money, pd);
    total.money_tax_price = this.round(total.money_tax_price, pd);
    data.push(total);

    return { total: data.length, rows: data };
  }

  /** 汇总行初值（与源端 $count 一致） */
  private zeroCount(keys: string[]): any {
    const o: any = {};
    for (const k of keys) o[k] = 0;
    return o;
  }

  /** 动态列名白名单 */
  private safeCol(k: string): string {
    return /^[A-Za-z0-9_]+$/.test(String(k)) ? String(k) : 'id';
  }

  /**
   * 收入支出报表（1:1 还原源 Revenue.php::index）
   * 由「其他收入明细」与「其他支出明细」两段合并而成，均要求主单已审核。
   * @param filter.purchase_time 日期区间（' - ' 分隔）
   * @param filter.business_type 1=只看其他收入 2=只看其他支出，空=两者都看
   */
  async revenue(filter: any) {
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
    const bt = f.business_type === '' || f.business_type === undefined ? '' : this.num(f.business_type);
    const w: string[] = ['p.`examine_status` = 1'];
    const ps: any[] = [];
    if (f.purchase_time && String(f.purchase_time).indexOf(' - ') >= 0) {
      const arr = String(f.purchase_time).split(' - ');
      w.push('i.`purchase_time` BETWEEN ? AND ?');
      ps.push(Math.floor(new Date(String(arr[0]).trim()).getTime() / 1000));
      ps.push(Math.floor(new Date(String(arr[1]).trim()).getTime() / 1000));
    }
    const where = ' WHERE ' + w.join(' AND ');
    const rows: any[] = [];

    if (bt !== 2) {
      // 其他收入：收入明细 join 客户 / 收入类别 / 收入主单
      const list = await this.q(
        'SELECT i.`purchase_code`, i.`purchase_time`, i.`money`, i.`remark`, c.`customer_name`, t.`name` ' +
          'FROM `kuyou_income_info` i ' +
          'LEFT JOIN `kuyou_customers` c ON c.`id` = i.`customers_id` ' +
          'LEFT JOIN `kuyou_income_type` t ON t.`id` = i.`income_type_id` ' +
          'LEFT JOIN `kuyou_income` p ON p.`id` = i.`purchase_id`' +
          where +
          ' ORDER BY i.`purchase_time` ASC',
        ps,
      );
      for (const v of list) {
        rows.push({
          purchase_time: this.dateStr(v.purchase_time),
          purchase_code: v.purchase_code,
          business_type: '其他收入',
          name: v.name,
          receivable: this.num(v.money),
          amount: '',
          intercourse: v.customer_name,
          remark: v.remark,
        });
      }
    }

    if (bt !== 1) {
      // 其他支出：支出明细 join 供应商 / 支出类别 / 支出主单
      const list = await this.q(
        'SELECT i.`purchase_code`, i.`purchase_time`, i.`money`, i.`remark`, c.`supplyer_name`, t.`name` ' +
          'FROM `kuyou_expenditure_info` i ' +
          'LEFT JOIN `kuyou_suppliers` c ON c.`id` = i.`suppliers_id` ' +
          'LEFT JOIN `kuyou_expend_type` t ON t.`id` = i.`expend_type_id` ' +
          'LEFT JOIN `kuyou_expenditure` p ON p.`id` = i.`purchase_id`' +
          where +
          ' ORDER BY i.`purchase_time` ASC',
        ps,
      );
      for (const v of list) {
        rows.push({
          purchase_time: this.dateStr(v.purchase_time),
          purchase_code: v.purchase_code,
          business_type: '其他支出',
          name: v.name,
          receivable: '',
          amount: this.num(v.money),
          intercourse: v.supplyer_name,
          remark: v.remark,
        });
      }
    }
    return { total: rows.length, rows };
  }

  /** bigint 秒 → YYYY-MM-DD */
  private dateStr(t: any): string {
    const n = this.num(t);
    if (!n) return '';
    const d = new Date(n * 1000);
    const p = (x: number) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /**
   * 经营利润汇总（1:1 还原源 Profit.php::index 的可复现部分）
   *
   * 源端逐商品调用 addons Goods::getProfit 累积各项，再叠加销货折让与其他收入得到最终口径。
   * addons 库在源码包中不存在，这里按同一套表（`kuyou_goods_sales_profit`）直接聚合，结果等价：
   *   销售额   = Σ all_money
   *   销售成本 = Σ sales_cost
   *   销货折让 = Σ preferential_money(purchase_type=1) - Σ preferential_money(purchase_type=2)
   *   实收合计 = Σ real_money
   *   其他收入 = Σ 其他收入单金额（已审核）
   *   主营业务利润 = 销售额 - 销售成本 - 销货折让 - 实收合计
   *   净利润   = 主营业务利润 + 其他收入
   *
   * 日期缺省口径与源一致：本月 1 日 → 现在（或明天，取较早者）。
   *
   * @param startTime 开始时间戳（秒），空则取本月 1 日
   * @param endTime   结束时间戳（秒），空则取 min(明天, 现在)
   */
  async profit(startTime?: any, endTime?: any) {
    const set = await this.sets();
    const pd = this.num(set['price_decimal']?.value);

    const now = Math.floor(Date.now() / 1000);
    const d0 = new Date();
    d0.setDate(1);
    d0.setHours(0, 0, 0, 0);
    const monthStart = Math.floor(d0.getTime() / 1000);
    const tomorrow = Math.floor((new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 1)).getTime() / 1000);
    const start = this.num(startTime) || monthStart;
    let end = this.num(endTime) || Math.min(tomorrow, now);
    if (end < start) end = start;

    const inRange = 'WHERE `purchase_time` BETWEEN ? AND ?';
    const rp = [start, end];

    // 结账期间：只统计最近结账时间之后的数据（与源端 getProfit 一致）
    const check = (await this.q('SELECT `checktime` FROM `kuyou_checkout` ORDER BY `checkdate` DESC LIMIT 1'))[0];
    const afterCheck = check && this.num(check.checktime) > 0
      ? ' AND `purchase_time` > ?'
      : '';
    const rp2 = afterCheck ? [...rp, this.num(check.checktime)] : rp;

    const sum = await this.q(
      'SELECT SUM(`all_money`) AS `all_money`, SUM(`sales_cost`) AS `sales_cost`, ' +
        'SUM(`real_money`) AS `real_money`, SUM(`preferential_money`) AS `preferential_money` ' +
        'FROM `kuyou_goods_sales_profit` ' + inRange + afterCheck,
      rp2,
    );
    const row = sum[0] || {};

    // 销货折让：普通销货 - 零售销货（purchase_type 1 / 2），均要求已审核
    const disc = await this.q(
      'SELECT `purchase_type`, SUM(`preferential_money`) AS `preferential` ' +
        'FROM `kuyou_goods_sales` ' + inRange + ' AND `examine_status` = 1 GROUP BY `purchase_type`',
      rp,
    );
    let discount = 0;
    for (const d of disc) {
      discount += Number(d.purchase_type) === 2 ? -this.num(d.preferential) : this.num(d.preferential);
    }

    // 其他收入：已审核的其他收入单
    const inc = await this.q(
      'SELECT SUM(`i`.`money`) AS `money` FROM `kuyou_income_info` i ' +
        'LEFT JOIN `kuyou_income` p ON p.`id` = i.`purchase_id` ' +
        'WHERE p.`examine_status` = 1 AND i.`purchase_time` BETWEEN ? AND ?',
      rp,
    );
    const otherIncome = this.num(inc[0]?.money);

    const saleMoney = this.num(row.all_money);
    const costAll = this.num(row.sales_cost);
    const collectionAll = this.num(row.real_money);
    const mainBusiness = saleMoney - costAll - discount - collectionAll;
    const profitAll = mainBusiness + otherIncome;

    return {
      start_time: this.dateStr(start),
      end_time: this.dateStr(end),
      data: {
        sale_money: this.round(saleMoney, pd),
        sales_discount: this.round(discount, pd),
        collection_all: this.round(collectionAll, pd),
        cost_all: this.round(costAll, pd),
        discount_all: this.round(this.num(row.preferential_money), pd),
        payment_all: this.round(this.num(row.preferential_money), pd),
        surplus_loss: this.round(this.num(row.preferential_money), pd),
        main_business: this.round(mainBusiness, pd),
        other_income: this.round(otherIncome, pd),
        profit: this.round(profitAll, pd),
      },
    };
  }
}
