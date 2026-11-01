import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

/**
 * 统计 / 数据中心服务
 *
 * 1:1 还原 kuyou Intercourse.php（往来单位欠款表）与 Datainfo.php（数据中心看板）：
 *  - intercourse：客户应收(need_receive_account) + 供应商应付(need_give_account) 列表
 *  - datainfo    ：近 7 日购货/销货趋势、按仓库库存统计、账户资金统计、本月购销汇总
 *
 * 安全：表名来自 kuyou_ 前缀；检索列白名单；取值参数化。
 */
@Injectable()
export class StatsService {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  private q(sql: string, params: any[] = []): Promise<any[]> {
    return this.conn.query(sql, params);
  }

  /**
   * 往来单位欠款表
   * @param types 1=仅客户 2=仅供应商 不传=全部
   * @param keyword 编码/名称关键字
   */
  async intercourse(types: number[] = [], keyword = '') {
    const list: any[] = [];
    const kw = keyword ? `%${keyword}%` : '';
    if (types.length === 0 || types.includes(1)) {
      const where = kw ? 'WHERE `customer_code` LIKE ? OR `customer_name` LIKE ?' : '';
      const params = kw ? [kw, kw] : [];
      const rows = await this.q(`SELECT \`customer_code\`,\`customer_name\`,\`need_receive_account\` FROM \`kuyou_customers\` ${where}`, params);
      rows.forEach((r) =>
        list.push({ code: r.customer_code, name: r.customer_name, type: 1, receive: Number(r.need_receive_account) || 0 }),
      );
    }
    if (types.length === 0 || types.includes(2)) {
      const where = kw ? 'WHERE `supplyer_code` LIKE ? OR `supplyer_name` LIKE ?' : '';
      const params = kw ? [kw, kw] : [];
      const rows = await this.q(`SELECT \`supplyer_code\`,\`supplyer_name\`,\`need_give_account\` FROM \`kuyou_suppliers\` ${where}`, params);
      rows.forEach((r) =>
        list.push({ code: r.supplyer_code, name: r.supplyer_name, type: 2, give: Number(r.need_give_account) || 0 }),
      );
    }
    return { total: list.length, rows: list };
  }

  /**
   * 数据中心看板数据
   * @param types 1=购货趋势 2=销货趋势 3=库存统计 4=账户统计
   */
  async datainfo(types: number) {
    const now = Math.floor(Date.now() / 1000);
    const start = now - 6 * 86400;
    const end = now;

    if (types === 3) {
      const stores = await this.q('SELECT `id`,`name` FROM `kuyou_stores` WHERE `status` = ?', ['1']);
      const data: { name: any; value: number }[] = [];
      for (const s of stores) {
        const v = await this.q('SELECT SUM(`stock`) AS stock FROM `kuyou_goods_stock` WHERE `stores_id` = ?', [s.id]);
        data.push({ name: s.name, value: Number(v[0]?.stock) || 0 });
      }
      return { title: '库存统计', legend: '库存数量', data };
    }
    if (types === 4) {
      const rows = await this.q('SELECT `account_name` AS name, `balance` AS value FROM `kuyou_accounts`');
      return { title: '账户统计', legend: '资金', data: rows.map((r) => ({ name: r.name, value: Number(r.value) || 0 })) };
    }

    const table = types === 2 ? 'kuyou_goods_sales' : 'kuyou_goods_purchase';
    const legend = types === 2 ? '销货金额' : '购货金额';
    const join = await this.q(
      `SELECT SUM(\`real_money\`) AS nums, DATE_FORMAT(FROM_UNIXTIME(\`purchase_time\`), '%Y-%m-%d') AS join_date
       FROM \`${table}\` WHERE \`purchase_time\` BETWEEN ? AND ? AND \`examine_status\` = '1'
       GROUP BY join_date`,
      [start, end],
    );
    const map: Record<string, number> = {};
    join.forEach((r) => (map[r.join_date] = Number(r.nums) || 0));
    const column: string[] = [];
    const data: number[] = [];
    for (let t = start; t <= end; t += 86400) {
      const d = new Date(t * 1000).toISOString().slice(0, 10);
      column.push(d);
      data.push(map[d] || 0);
    }
    return { legend, column, data };
  }

  /** 本月购销汇总（数据中心首页卡片） */
  async datainfoSummary() {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    const monthStart = Math.floor(new Date(y, m, 1).getTime() / 1000);
    const monthEnd = Math.floor(new Date(y, m + 1, 1).getTime() / 1000) - 1;

    const purchaseCode = await this.q('SELECT `purchase_code` FROM `kuyou_goods_purchase` WHERE `examine_status` = ? AND `purchase_time` BETWEEN ? AND ?', ['1', monthStart, monthEnd]);
    const salesCode = await this.q('SELECT `purchase_code` FROM `kuyou_goods_sales` WHERE `examine_status` = ? AND `purchase_time` BETWEEN ? AND ?', ['1', monthStart, monthEnd]);
    const pCodes = purchaseCode.map((r) => r.purchase_code);
    const sCodes = salesCode.map((r) => r.purchase_code);

    const pNum = pCodes.length
      ? (await this.q(`SELECT SUM(\`basic_nmber\`) AS n, SUM(\`real_money\`) AS m FROM \`kuyou_goods_purchase_info\` WHERE \`purchase_code\` IN (?)`, [pCodes]))[0]
      : { n: 0, m: 0 };
    const sNum = sCodes.length
      ? (await this.q(`SELECT SUM(\`basic_nmber\`) AS n, SUM(\`real_money\`) AS m FROM \`kuyou_goods_sales_info\` WHERE \`purchase_code\` IN (?)`, [sCodes]))[0]
      : { n: 0, m: 0 };
    const stockNum = (await this.q('SELECT SUM(\`inventory\`) AS n FROM `kuyou_goods` WHERE `status` = ?', ['1']))[0]?.n || 0;

    return {
      purchase_num: Number(pNum?.n) || 0,
      purchase_mon: Number(pNum?.m) || 0,
      sales_num: Number(sNum?.n) || 0,
      sales_mon: Number(sNum?.m) || 0,
      stock_num: Number(stockNum) || 0,
    };
  }

  /**
   * 生产成本统计（1:1 还原 kuyou Acceptances.php 生产成本页）
   *
   * 对每条验收单（kuyou_acceptance，code_type:1=加工单 / 2=委外加工单），关联
   * kuyou_production / kuyou_outsourcing / kuyou_plan / kuyou_bom / kuyou_bom_procedure /
   * kuyou_material 等，计算：
   *   生产成本 = 委外费 + 计时工资 + 计件工资 + 生产费用 - 退料金额
   * 其中计件工资 = Σ(工序计件单价 × 验收数量)，
   *      计时工资 = Σ(工序工资 × 标准工时 × 验收数量)。
   *
   * @param query page / limit / workshop_id / code_type / keyword
   */
  async productionCost(query: any = {}) {
    const page = Math.max(1, parseInt(query.page as string, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(query.limit as string, 10) || 10));
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const params: any[] = [];
    if (query.workshop_id) {
      where.push('`workshop_id` = ?');
      params.push(query.workshop_id);
    }
    if (query.code_type) {
      where.push('`code_type` = ?');
      params.push(query.code_type);
    }
    if (query.keyword) {
      where.push('(`purchase_code` LIKE ? OR `goods_name` LIKE ?)');
      params.push(`%${query.keyword}%`, `%${query.keyword}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalRow = await this.q(`SELECT COUNT(*) AS c FROM \`kuyou_acceptance\` ${whereSql}`, params);
    const total = Number(totalRow[0]?.c) || 0;
    const rows = await this.q(
      `SELECT * FROM \`kuyou_acceptance\` ${whereSql} ORDER BY \`id\` DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const out: any[] = [];
    for (const a of rows) {
      const row: any = { ...a };
      const acceptanceQty: Record<string, number> = {};
      const accInfo = await this.q('SELECT `goods_code`,`number` FROM `kuyou_acceptance_info` WHERE `production_id` = ?', [a.id]);
      for (const r of accInfo) acceptanceQty[r.goods_code] = Number(r.number) || 0;

      let outsourcingFree = 0;
      let productionInfo: any[] = [];
      let goodsList: any[] = [];
      let materialInfo: any[] = [];

      if (String(a.code_type) === '1') {
        const production = (await this.q('SELECT * FROM `kuyou_production` WHERE `purchase_code` = ? LIMIT 1', [a.chase_code]))[0];
        if (production) {
          productionInfo = await this.q("SELECT * FROM `kuyou_production_info` WHERE `production_id` = ? AND `type` = '1'", [production.id]);
          if (production.plan_code) {
            const planId = (await this.q('SELECT `id` FROM `kuyou_plan` WHERE `purchase_code` = ? LIMIT 1', [production.plan_code]))[0]?.id;
            if (planId) goodsList = await this.q('SELECT `goods_name`,`number`,`goods_code` FROM `kuyou_plan_info` WHERE `plan_id` = ?', [planId]);
          }
        }
        const material = (await this.q('SELECT `id` FROM `kuyou_material` WHERE `production_code` = ? LIMIT 1', [a.chase_code]))[0];
        if (material) materialInfo = await this.q('SELECT * FROM `kuyou_material_info` WHERE `production_id` = ?', [material.id]);
      } else {
        const plan = (await this.q('SELECT * FROM `kuyou_outsourcing` WHERE `purchase_code` = ? LIMIT 1', [a.chase_code]))[0];
        if (plan) {
          outsourcingFree = Number(plan.free_money) || 0;
          productionInfo = await this.q('SELECT * FROM `kuyou_outsourcing_info` WHERE `production_id` = ?', [plan.id]);
          if (plan.plan_code) {
            const planId = (await this.q('SELECT `id` FROM `kuyou_plan` WHERE `purchase_code` = ? LIMIT 1', [plan.plan_code]))[0]?.id;
            if (planId) goodsList = await this.q('SELECT `goods_name`,`number`,`goods_code` FROM `kuyou_plan_info` WHERE `plan_id` = ?', [planId]);
          }
        }
        const material = (await this.q('SELECT `id` FROM `kuyou_material` WHERE `plan_code` = ? LIMIT 1', [a.chase_code]))[0];
        if (material) materialInfo = await this.q('SELECT * FROM `kuyou_material_info` WHERE `production_id` = ?', [material.id]);
      }

      let wagesFree = 0;
      let hourFree = 0;
      for (const g of goodsList) {
        const qty = acceptanceQty[g.goods_code];
        if (!qty) continue;
        const bom = (await this.q('SELECT `id`,`wages` FROM `kuyou_bom` WHERE `goods_code` = ? LIMIT 1', [g.goods_code]))[0];
        if (!bom) continue;
        wagesFree += Number(bom.wages || 0) * qty;
        const procedures = await this.q('SELECT `wages`,`hours` FROM `kuyou_bom_procedure` WHERE `bom_id` = ?', [bom.id]);
        for (const p of procedures) hourFree += Number(p.wages || 0) * Number(p.hours || 0) * qty;
      }

      const productionFree = productionInfo.reduce((s: number, r: any) => s + (Number(r.money) || 0), 0);
      const materialFree = materialInfo.reduce((s: number, r: any) => s + (Number(r.money) || 0), 0);
      const costFree = outsourcingFree + hourFree + wagesFree + productionFree - materialFree;

      const ws = (await this.q('SELECT `name` FROM `kuyou_workshop` WHERE `id` = ? LIMIT 1', [a.workshop_id]))[0];
      row.workshop_name = ws?.name || '';
      row.goods_info = goodsList.map((g) => `${g.goods_name}*${g.number}`).join(' ');
      row.outsourcing_free = outsourcingFree;
      row.hour_free = hourFree;
      row.wages_free = wagesFree;
      row.production_free = productionFree;
      row.material_free = materialFree;
      row.cost_free = costFree;
      out.push(row);
    }
    return { total, rows: out };
  }

  /** 生产数据面板汇总：生产单 / 验收单 / 生产计划 / 委外单 数量概览 */
  async productionSummary() {
    const q1 = (await this.q('SELECT COUNT(*) AS c FROM `kuyou_production`'))[0]?.c || 0;
    const q2 = (await this.q('SELECT COUNT(*) AS c FROM `kuyou_acceptance`'))[0]?.c || 0;
    const q3 = (await this.q('SELECT COUNT(*) AS c FROM `kuyou_plan`'))[0]?.c || 0;
    const q4 = (await this.q('SELECT COUNT(*) AS c FROM `kuyou_outsourcing`'))[0]?.c || 0;
    return {
      production_count: Number(q1),
      acceptance_count: Number(q2),
      plan_count: Number(q3),
      outsourcing_count: Number(q4),
    };
  }
}
