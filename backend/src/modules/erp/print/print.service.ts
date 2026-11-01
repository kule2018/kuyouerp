import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { PRINT_TYPES, PrintConfig, DocPrintConfig, SummaryPrintConfig } from './print.config';

/** 四舍五入（与 PHP round 一致：四舍六入五成双，这里用 toFixed 近似，金额场景足够） */
function round(v: number, precision: number): number {
  const f = Math.pow(10, precision);
  return Math.round((v + Number.EPSILON) * f) / f;
}

/**
 * 打印引擎服务
 *
 * 1:1 还原 kuyou Prints.php：
 *  - document 模式：按 id 取主表 + 明细，富化商品/单位/仓库/往来/经手人，算数量与金额合计，并生成人民币大写；
 *    同时自增主表 print_num（与 PHP `inc('print_num')` 一致）。
 *  - summary 模式：按检索条件取聚合数据（采购明细 / 订单跟踪 / 采购汇总 / 付款流水 / 销售跟踪），供报表打印。
 *
 * 安全：表名来自白名单 PRINT_TYPES；检索列经 searchCols 白名单校验；取值一律参数化。
 */
@Injectable()
export class PrintService {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  /** 统一查询封装 */
  private q(sql: string, params: any[] = []): Promise<any[]> {
    return this.conn.query(sql, params);
  }

  /** 取系统小数位设置 */
  private async getDecimal(name: string, def = 2): Promise<number> {
    const rows = await this.q('SELECT `value` FROM `kuyou_sets` WHERE `name` = ? LIMIT 1', [name]);
    const v = rows[0]?.value;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }

  /** 取公司名称（打印抬头） */
  private async getCompanyName(): Promise<string> {
    const rows = await this.q("SELECT `value` FROM `kuyou_sets` WHERE `name` = 'company_name' LIMIT 1");
    return rows[0]?.value || '';
  }

  /** 取管理员（制单人） */
  private async getAdmin(id: any): Promise<any> {
    if (id === undefined || id === null || id === '') return null;
    const rows = await this.q('SELECT * FROM `admin` WHERE `id` = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  /** 商品富化：按编码或主键取商品，并拼接规格 + 辅助属性名（1:1 还原 getGoods） */
  private async getGoods(goodsCode?: any, goodsAttr?: any, goodsId?: any): Promise<any> {
    let goods: any = null;
    if (goodsCode !== undefined && goodsCode !== null && goodsCode !== '') {
      const rows = await this.q('SELECT * FROM `kuyou_goods` WHERE `goods_code` = ? LIMIT 1', [goodsCode]);
      goods = rows[0] || {};
    } else if (goodsId !== undefined && goodsId !== null && goodsId !== '') {
      const rows = await this.q('SELECT * FROM `kuyou_goods` WHERE `id` = ? LIMIT 1', [goodsId]);
      goods = rows[0] || {};
    } else {
      return {};
    }
    let attrName = '';
    if (goodsAttr) {
      const attrRows = await this.q('SELECT `attribute_id` FROM `kuyou_goods_attr` WHERE `id` = ? LIMIT 1', [goodsAttr]);
      const attributeId = attrRows[0]?.attribute_id;
      if (attributeId) {
        const comboRows = await this.q('SELECT `attr_ids` FROM `kuyou_aux_combination` WHERE `id` = ? LIMIT 1', [attributeId]);
        const attrIds = comboRows[0]?.attr_ids;
        if (attrIds) {
          const ids = String(attrIds).split('&');
          const auxRows = await this.q('SELECT `name` FROM `kuyou_auxiliary` WHERE `id` IN (?)', [ids]);
          attrName = auxRows.map((a: any) => a.name).join('/');
        }
      }
    }
    goods.goods_name =
      (goods.goods_name || '') +
      (goods.goods_specification_id ? '_' + goods.goods_specification_id : '') +
      (attrName ? '_' + attrName : '');
    return goods;
  }

  /** 结算方式映射 */
  private async settlementTypes(): Promise<Record<string, string>> {
    const rows = await this.q('SELECT `id`,`name` FROM `kuyou_settlementtype`');
    const m: Record<string, string> = {};
    rows.forEach((r: any) => (m[r.id] = r.name));
    return m;
  }

  /** 类型名称映射（其他收入 / 其他支出） */
  private async typeNameMap(table: string): Promise<Record<string, string>> {
    const rows = await this.q(`SELECT \`id\`,\`name\` FROM \`${table}\``);
    const m: Record<string, string> = {};
    rows.forEach((r: any) => (m[r.id] = r.name));
    return m;
  }

  /**
   * 人民币大写转换（1:1 还原 PHP num_to_rmb）
   * @param num 数值
   * @returns 人民币大写字符串，如 "壹佰元整"
   */
  numToRmb(num: number): string {
    const c1 = '零壹贰叁肆伍陆柒捌玖';
    const c2 = '分角元拾佰仟万拾佰仟亿';
    let n = round(Number(num) || 0, 2);
    n = n * 100;
    if (String(Math.floor(n)).length > 10) return '金额太大，请检查';
    let i = 0;
    let c = '';
    while (true) {
      let digit: number;
      if (i === 0) {
        digit = Number(String(Math.floor(n)).slice(-1));
      } else {
        digit = Math.floor(n) % 10;
      }
      const p1 = c1.substr(digit * 1, 1);
      const p2 = c2.substr(i * 1, 1);
      if (digit !== 0 || (digit === 0 && (p2 === '亿' || p2 === '万' || p2 === '元'))) {
        c = p1 + p2 + c;
      } else {
        c = p1 + c;
      }
      i += 1;
      n = Math.floor(n / 10);
      if (n === 0) break;
    }
    let j = 0;
    const slen = c.length;
    while (j < c.length) {
      const m = c.substr(j, 2);
      if (m === '零元' || m === '零万' || m === '零亿' || m === '零零') {
        c = c.slice(0, j) + c.slice(j + 1);
        j = j - 1;
      }
      j += 1;
    }
    if (c.slice(-1) === '零') c = c.slice(0, -1);
    if (c === '') return '零元整';
    return c + '整';
  }

  /** 校验 type 合法 */
  private cfg(type: string): PrintConfig {
    const c = PRINT_TYPES[type];
    if (!c) throw new BadRequestException('参数错误');
    return c;
  }

  /** 对外入口：根据 type 分发到单据或汇总打印 */
  async print(type: string, ids: string[], search: Record<string, any> = {}): Promise<any> {
    const c = this.cfg(type);
    if (c.mode === 'document') {
      return this.assembleDocument(c as DocPrintConfig, ids);
    }
    return this.assembleSummary(c as SummaryPrintConfig, search);
  }

  /** 单据装配 */
  private async assembleDocument(cfg: DocPrintConfig, ids: string[]): Promise<any> {
    if (!ids || ids.length === 0) throw new BadRequestException('参数错误');
    const numberDecimal = await this.getDecimal('number_decimal', 2);
    const priceDecimal = await this.getDecimal('price_decimal', 2);
    const companyName = await this.getCompanyName();

    const idNums = ids.map((x) => (String(x).includes(',') ? x.split(',') : x)).flat().filter(Boolean);
    const placeholders = idNums.map(() => '?').join(',');
    const headerRows = await this.q(`SELECT * FROM \`${cfg.header}\` WHERE \`id\` IN (${placeholders})`, idNums);
    if (!headerRows.length) throw new BadRequestException('未查询到相关数据');
    // 自增打印次数（与 PHP inc('print_num') 一致）
    await this.q(`UPDATE \`${cfg.header}\` SET \`print_num\` = \`print_num\` + 1 WHERE \`id\` IN (${placeholders})`, idNums);

    const settlementMap = cfg.accounts ? await this.settlementTypes() : {};
    const incomeMap = cfg.incomeExpend === 'income' ? await this.typeNameMap('kuyou_income_type') : {};
    const expendMap = cfg.incomeExpend === 'expend' ? await this.typeNameMap('kuyou_expend_type') : {};

    const list: any[] = [];
    for (const row of headerRows) {
      // 退换货单金额覆盖
      if (cfg.headerMoneyOverride) {
        row.money_tax_price = round((Number(row.real_money) || 0) + (Number(row.preferential_money) || 0), priceDecimal);
      }

      // 明细富化
      if (cfg.detail) {
        const dlf = cfg.detailLinkField || cfg.linkField;
        const linkVal = row[cfg.linkField];
        const details = await this.q(`SELECT * FROM \`${cfg.detail}\` WHERE \`${dlf}\` = ?`, [linkVal]);
        let number = 0;
        let money = 0;
        for (const v of details) {
          if (cfg.numberField === 'retreat_number') v.number = v.retreat_number;
          v.goods = await this.getGoods(
            cfg.goodsBy === 'code' ? v.goods_code : undefined,
            v.goods_attr,
            cfg.goodsBy === 'id' ? v.goods_id : undefined,
          );
          v.unit = (await this.q('SELECT * FROM `kuyou_unit` WHERE `id` = ? LIMIT 1', [v.goods_unit]))[0] || null;
          if (cfg.detailStoresFields === 'out_enter') {
            v.stores_out = (await this.q('SELECT * FROM `kuyou_stores` WHERE `id` = ? LIMIT 1', [v.stores_out]))[0] || null;
            v.stores_enter = (await this.q('SELECT * FROM `kuyou_stores` WHERE `id` = ? LIMIT 1', [v.stores_enter]))[0] || null;
          } else {
            v.stores = (await this.q('SELECT * FROM `kuyou_stores` WHERE `id` = ? LIMIT 1', [v.stores_id]))[0] || null;
          }
          const ln = Number(v[cfg.numberField] || 0);
          const ml = cfg.moneyField ? Number(v[cfg.moneyField] || 0) : 0;
          if (cfg.moneyTypeFilter != null) {
            if (v.type === cfg.moneyTypeFilter) {
              number += ln;
              money += ml;
            }
          } else {
            number += ln;
            money += ml;
          }
        }
        row.print_number = round(number, numberDecimal);
        row.print_money = round(money, priceDecimal);
        row.print_money_c = this.numToRmb(money);
        const outField = cfg.detailOutField || 'purchase_info';
        row[outField] = details;
      }

      // 制单人
      row.preparation = await this.getAdmin(row.preparation_id);
      if (row.preparation?.nickname) row.preparation.username = row.preparation.nickname;

      // 往来方
      if (cfg.party) {
        const p = cfg.party;
        if (p.by === 'code') {
          row[p.outField] = (await this.q(`SELECT * FROM \`${p.table}\` WHERE \`${p.key}\` = ? LIMIT 1`, [row[p.headerField]]))[0] || null;
        } else {
          row[p.outField] = (await this.q(`SELECT * FROM \`${p.table}\` WHERE \`id\` = ? LIMIT 1`, [row[p.headerField]]))[0] || null;
        }
      }

      // 销售员
      if (cfg.staff) {
        row.staff_member = (await this.q('SELECT * FROM `kuyou_staff_member` WHERE `id` = ? LIMIT 1', [row.sale_user]))[0] || null;
      }

      // 收付款单：账户 + 关联销售
      if (cfg.accounts) {
        const accTable = cfg.key === 'fkd' ? 'kuyou_payment_account' : 'kuyou_collection_account';
        const saleTable = cfg.key === 'fkd' ? 'kuyou_payment_sale' : 'kuyou_collection_sale';
        const accRows = await this.q(`SELECT * FROM \`${accTable}\` WHERE \`collection_id\` = ?`, [row.id]);
        let money = 0;
        for (const v of accRows) {
          money += Number(v.money || 0);
          v.accounts = (await this.q('SELECT * FROM `kuyou_accounts` WHERE `id` = ? LIMIT 1', [v.accounts_id]))[0] || null;
          v.settlementtype = settlementMap[v.settlementtype] || '';
        }
        row.print_money = round(money, priceDecimal);
        row.print_money_c = this.numToRmb(money);
        row.payment_account = accRows;
        row.payment_sale = await this.q(`SELECT * FROM \`${saleTable}\` WHERE \`collection_id\` = ?`, [row.id]);
      }

      // 核销单
      if (cfg.writeoff) {
        const bt = ['', '预收冲应收', '预付冲应付', '应收冲应付', '应收转应收', '应付转应付'];
        row.business_type_text = bt[row.business_type] || '';
        if (row.business_type === 1) {
          row.customers_id = (await this.q('SELECT `customer_name` FROM `kuyou_customers` WHERE `id` = ? LIMIT 1', [row.customers_id]))[0]?.customer_name || '';
        } else if (row.business_type === 2) {
          row.suppliers_id = (await this.q('SELECT `supplyer_name` FROM `kuyou_suppliers` WHERE `id` = ? LIMIT 1', [row.suppliers_id]))[0]?.supplyer_name || '';
        } else if (row.business_type === 3) {
          row.customers_id = (await this.q('SELECT `customer_name` FROM `kuyou_customers` WHERE `id` = ? LIMIT 1', [row.customers_id]))[0]?.customer_name || '';
          row.suppliers_id = (await this.q('SELECT `supplyer_name` FROM `kuyou_suppliers` WHERE `id` = ? LIMIT 1', [row.suppliers_id]))[0]?.supplyer_name || '';
        } else if (row.business_type === 4) {
          row.customers_out_id = (await this.q('SELECT `customer_name` FROM `kuyou_customers` WHERE `id` = ? LIMIT 1', [row.customers_out_id]))[0]?.customer_name || '';
          row.customers_enter_id = (await this.q('SELECT `customer_name` FROM `kuyou_customers` WHERE `id` = ? LIMIT 1', [row.customers_enter_id]))[0]?.customer_name || '';
        } else {
          row.suppliers_out_id = (await this.q('SELECT `supplyer_name` FROM `kuyou_suppliers` WHERE `id` = ? LIMIT 1', [row.suppliers_out_id]))[0]?.supplyer_name || '';
          row.suppliers_enter_id = (await this.q('SELECT `supplyer_name` FROM `kuyou_suppliers` WHERE `id` = ? LIMIT 1', [row.suppliers_enter_id]))[0]?.supplyer_name || '';
        }
        row.purchase_info = await this.q('SELECT * FROM `kuyou_writeoff_info` WHERE `collection_id` = ?', [row.id]);
      }

      // 其他收支单
      if (cfg.incomeExpend) {
        const infoTable = cfg.incomeExpend === 'income' ? 'kuyou_income_info' : 'kuyou_expenditure_info';
        const infoRows = await this.q(`SELECT * FROM \`${infoTable}\` WHERE \`purchase_code\` = ?`, [row.purchase_code]);
        let money = 0;
        for (const v of infoRows) {
          money += Number(v.money || 0);
          if (cfg.incomeExpend === 'income') v.income_type_id = incomeMap[v.income_type_id] || '';
          else v.expend_type_id = expendMap[v.expend_type_id] || '';
        }
        row.print_money = round(money, priceDecimal);
        row.print_money_c = this.numToRmb(money);
        row.accounts = (await this.q('SELECT * FROM `kuyou_accounts` WHERE `id` = ? LIMIT 1', [row.accounts_id]))[0] || null;
        row.purchase_info = infoRows;
      }

      list.push(row);
    }

    return { type: cfg.key, title: cfg.title, company_name: companyName, list };
  }

  /** 构造检索条件（1:1 还原 PHP 的 search 解析：时间区间 BETWEEN，其余 LIKE） */
  private buildSearch(search: Record<string, any>, allowed: string[], baseWhere: string[] = [], baseParams: any[] = []): { where: string; params: any[] } {
    const conds: string[] = [...baseWhere];
    const params: any[] = [...baseParams];
    for (const k of Object.keys(search || {})) {
      if (!allowed.includes(k)) continue;
      const v = search[k];
      if (v === undefined || v === null || v === '') continue;
      if (typeof v === 'string' && v.includes(' - ') && k.includes('time')) {
        const [a, b] = v.split(' - ');
        conds.push(`\`${k}\` BETWEEN ? AND ?`);
        params.push(Math.floor(Date.parse(a.replace(' ', 'T')) / 1000), Math.floor(Date.parse(b.replace(' ', 'T')) / 1000));
      } else {
        conds.push(`\`${k}\` LIKE ?`);
        params.push(`%${v}%`);
      }
    }
    return { where: conds.length ? 'WHERE ' + conds.join(' AND ') : '', params };
  }

  /** 汇总表装配 */
  private async assembleSummary(cfg: SummaryPrintConfig, search: Record<string, any>): Promise<any> {
    const priceDecimal = await this.getDecimal('price_decimal', 2);
    const numberDecimal = await this.getDecimal('number_decimal', 2);
    const companyName = await this.getCompanyName();
    let list: any[] = [];
    let totals: any = {};

    if (cfg.key === 'cgmx') {
      // 采购明细（已审核）
      const { where, params } = this.buildSearch(search, cfg.searchCols, ['`examine_status` = ?'], ['1']);
      const rows = await this.q(`SELECT * FROM \`kuyou_goods_purchase_info\` ${where} ORDER BY \`id\` ASC`, params);
      for (const v of rows) {
        v.goods = await this.getGoods(v.goods_code, v.goods_attr);
        v.unit = (await this.q('SELECT * FROM `kuyou_unit` WHERE `id` = ? LIMIT 1', [v.goods_unit]))[0] || null;
        v.suppliers = (await this.q('SELECT * FROM `kuyou_suppliers` WHERE `supplyer_code` = ? LIMIT 1', [v.supplyer_code]))[0] || null;
        v.stores = (await this.q('SELECT * FROM `kuyou_stores` WHERE `id` = ? LIMIT 1', [v.stores_id]))[0] || null;
        if (v.purchase_type == 1) {
          v.note = (await this.q('SELECT `note` FROM `kuyou_goods_purchase` WHERE `purchase_code` = ? LIMIT 1', [v.purchase_code]))[0]?.note || '';
        } else {
          v.note = (await this.q('SELECT `note` FROM `kuyou_goods_exchange` WHERE `purchase_code` = ? LIMIT 1', [v.purchase_code]))[0]?.note || '';
          v.number = -Number(v.number || 0);
          v.all_money = -Number(v.all_money || 0);
          v.tax_money = -Number(v.tax_money || 0);
          v.money_tax_price = -Number(v.money_tax_price || 0);
        }
        v.number = round(Number(v.number || 0), numberDecimal);
        v.unit_price = round(Number(v.unit_price || 0), priceDecimal);
        v.tax_included = round(Number(v.tax_included || 0), priceDecimal);
        v.all_money = round(Number(v.all_money || 0), priceDecimal);
        v.purchase_money = round(Number(v.purchase_money || 0), priceDecimal);
        v.tax_money = round(Number(v.tax_money || 0), priceDecimal);
        v.money_tax_price = round(Number(v.money_tax_price || 0), priceDecimal);
      }
      const sums = await this.q(
        `SELECT SUM(\`number\`) AS number, SUM(\`all_money\`) AS all_money, SUM(\`purchase_money\`) AS purchase_money, SUM(\`tax_money\`) AS tax_money, SUM(\`money_tax_price\`) AS money_tax_price FROM \`kuyou_goods_purchase_info\` ${where}`,
        params,
      );
      const s = sums[0] || {};
      totals = {
        number: round(Number(s.number || 0), numberDecimal),
        unit_price: Number(s.number) > 0 ? round(Number(s.all_money || 0) / Number(s.number), priceDecimal) : 0,
        tax_included: Number(s.number) > 0 ? round(Number(s.money_tax_price || 0) / Number(s.number), priceDecimal) : 0,
        all_money: round(Number(s.all_money || 0), priceDecimal),
        purchase_money: round(Number(s.purchase_money || 0), priceDecimal),
        tax_money: round(Number(s.tax_money || 0), priceDecimal),
        money_tax_price: round(Number(s.money_tax_price || 0), priceDecimal),
      };
      list = rows;
    } else if (cfg.key === 'cgddgz' || cfg.key === 'xsddgz') {
      // 采购 / 销售 订单跟踪
      const isSale = cfg.key === 'xsddgz';
      const infoTable = isSale ? 'kuyou_goods_sales_order_info' : 'kuyou_goods_purchase_order_info';
      const orderTable = isSale ? 'kuyou_goods_sales_order' : 'kuyou_goods_purchase_order';
      const linkTable = isSale ? 'kuyou_goods_saleord_info' : 'kuyou_goods_purord_info';
      const excTable = isSale ? 'kuyou_goods_saleexc_info' : 'kuyou_goods_excpur_info';
      const partyTable = isSale ? 'kuyou_customers' : 'kuyou_suppliers';
      const partyField = isSale ? 'customer_name' : 'supplyer_name';
      const { where, params } = this.buildSearch(search, cfg.searchCols);
      const rows = await this.q(
        `SELECT i.*, g.goods_name, g.goods_specification_id,
                s.\`${partyField}\` AS s_name, r.name AS r_name, u.name AS unitname
         FROM \`${infoTable}\` i
         LEFT JOIN \`${orderTable}\` po ON po.purchase_code = i.purchase_code
         LEFT JOIN \`kuyou_goods\` g ON g.goods_code = i.goods_code
         LEFT JOIN \`kuyou_unit\` u ON u.id = i.default_unit
         LEFT JOIN \`${partyTable}\` s ON s.\`${isSale ? 'id' : 'supplyer_code'}\` = i.\`${isSale ? 'customers_id' : 'supplyer_code'}\`
         LEFT JOIN \`kuyou_stores\` r ON r.id = i.stores_id
         ${where} ORDER BY i.goods_code DESC`,
        params,
      );
      for (const v of rows) {
        const purord = (await this.q(`SELECT SUM(\`number\`) AS number, SUM(\`money_tax_price\`) AS all_money, MAX(\`purchase_id\`) AS purchase_id FROM \`${linkTable}\` WHERE \`order_id\` = ? AND \`status\` = '1'`, [v.id]))[0] || {};
        const exc = await this.q(`SELECT * FROM \`${excTable}\` WHERE \`purchase_id\` = ? AND \`status\` = '1' LIMIT 1`, [purord.purchase_id]);
        let libNumber = Number(v.number || 0);
        let libMoney = Number(v.money_tax_price || 0);
        if (purord) {
          libNumber = round(libNumber - Number(purord.number || 0), 2);
          libMoney = round(libMoney - Number(purord.all_money || 0), 4);
          if (exc && exc[0]) {
            libNumber = round(libNumber - Number(exc[0].number || 0), 2);
            libMoney = round(libMoney - Number(exc[0].money_tax_price || 0), 4);
          }
        }
        v.library_number = libNumber;
        v.library_money = libMoney;
        v.status = libNumber > 0 && libNumber < Number(v.number || 0) ? 2 : libNumber > 0 ? 0 : 1;
        const goods = await this.getGoods(v.goods_code, v.goods_attr);
        v.goods_name = goods.goods_name || v.goods_name;
        if (v.purchase_type == 2) {
          v.number = -Number(v.number || 0);
          v.money_tax_price = -Number(v.money_tax_price || 0);
          v.library_number = -libNumber;
          v.library_money = -libMoney;
        }
      }
      totals = {
        number: round(rows.reduce((a: number, r: any) => a + Number(r.number || 0), 0), numberDecimal),
        money_tax_price: round(rows.reduce((a: number, r: any) => a + Number(r.money_tax_price || 0), 0), priceDecimal),
        library_number: round(rows.reduce((a: number, r: any) => a + Number(r.library_number || 0), 0), numberDecimal),
        library_money: round(rows.reduce((a: number, r: any) => a + Number(r.library_money || 0), 0), priceDecimal),
      };
      list = rows;
    } else if (cfg.key === 'cghzb_sp' || cfg.key === 'cghzb_gys') {
      // 采购汇总（按商品 / 按供应商）
      const { where, params } = this.buildSearch(search, cfg.searchCols);
      let rows: any[] = [];
      if (cfg.key === 'cghzb_sp') {
        rows = await this.q(
          `SELECT i.goods_code, i.stores_id, SUM(i.basic_nmber) AS basic_nmber, SUM(i.number) AS i_number,
                  SUM(i.all_money) AS all_money, SUM(i.tax_money) AS tax_money, SUM(i.money_tax_price) AS money_tax_price,
                  i.default_unit, i.goods_unit, i.purchase_money,
                  g.goods_name, g.goods_specification_id, s.name AS s_name, u.name AS u_name
           FROM \`kuyou_goods_purchase_summary\` i
           LEFT JOIN \`kuyou_goods\` g ON g.goods_code = i.goods_code
           LEFT JOIN \`kuyou_stores\` s ON s.id = i.stores_id
           LEFT JOIN \`kuyou_unit\` u ON u.id = i.goods_unit
           ${where} GROUP BY i.goods_code, i.stores_id ORDER BY i.goods_code DESC`,
          params,
        );
      } else {
        const supRows = await this.q('SELECT sp.supplyer_code, sp.supplyer_name, gt.supplier_type_name FROM `kuyou_suppliers` sp LEFT JOIN `kuyou_supplyertype` gt ON gt.id = sp.supplyertype_id');
        for (const sup of supRows) {
          const srows = await this.q(
            `SELECT i.goods_code, i.stores_id, SUM(i.basic_nmber) AS basic_nmber, SUM(i.number) AS i_number,
                    SUM(i.all_money) AS all_money, SUM(i.tax_money) AS tax_money, SUM(i.money_tax_price) AS money_tax_price,
                    i.default_unit, i.goods_unit, i.purchase_money,
                    g.goods_name, g.goods_specification_id, g.unit_id, g.more_unit, s.name AS s_name, u.name AS u_name
             FROM \`kuyou_goods_purchase_summary\` i
             LEFT JOIN \`kuyou_goods\` g ON g.goods_code = i.goods_code
             LEFT JOIN \`kuyou_stores\` s ON s.id = i.stores_id
             LEFT JOIN \`kuyou_unit\` u ON u.id = i.goods_unit
             ${where} AND i.supplyer_code = ? GROUP BY i.goods_code, i.stores_id ORDER BY i.goods_code DESC`,
            [...params, sup.supplyer_code],
          );
          for (const v of srows) {
            v.i_number = v.basic_nmber;
            v.supplyer_name = sup.supplyer_name;
            v.supplier_type_name = sup.supplier_type_name;
            v.all_money = round(Number(v.all_money || 0), priceDecimal);
            v.tax_money = round(Number(v.tax_money || 0), priceDecimal);
            v.money_tax_price = round(Number(v.money_tax_price || 0), priceDecimal);
            rows.push(v);
          }
        }
      }
      let i_number = 0, all_money = 0, purchase_money = 0, tax_money = 0, money_tax_price = 0;
      for (const v of rows) {
        i_number += Number(v.i_number || 0);
        all_money += Number(v.all_money || 0);
        purchase_money += Number(v.purchase_money || 0);
        tax_money += Number(v.tax_money || 0);
        money_tax_price += Number(v.money_tax_price || 0);
        v.i_number = round(Number(v.i_number || 0), numberDecimal);
        v.unit_price = Number(v.i_number) !== 0 ? round(Number(v.all_money || 0) / Number(v.i_number), priceDecimal) : 0;
        v.all_money = round(Number(v.all_money || 0), priceDecimal);
        v.tax_money = round(Number(v.tax_money || 0), priceDecimal);
        v.money_tax_price = round(Number(v.money_tax_price || 0), priceDecimal);
      }
      totals = {
        i_number: round(i_number, numberDecimal),
        unit_price: i_number > 0 ? round(all_money / i_number, priceDecimal) : 0,
        all_money: round(all_money, priceDecimal),
        purchase_money: round(purchase_money, priceDecimal),
        tax_money: round(tax_money, priceDecimal),
        money_tax_price: round(money_tax_price, priceDecimal),
      };
      list = rows;
    } else if (cfg.key === 'cgfk') {
      // 采购付款流水
      const { where, params } = this.buildSearch(search, cfg.searchCols);
      const rows = await this.q(`SELECT * FROM \`kuyou_payment_log\` ${where} ORDER BY \`bill_code\` ASC, \`id\` ASC`, params);
      for (const v of rows) {
        v.supplyer_name = (await this.q('SELECT `supplyer_name` FROM `kuyou_suppliers` WHERE `supplyer_code` = ? LIMIT 1', [v.suppliers_code]))[0]?.supplyer_name || '';
      }
      const sumCols = ['money_tax_price', 'purchase_money', 'discount_money', 'real_money', 'pay_money', 'give_money'];
      totals = { s_name: '合计', bill_time: '' };
      for (const c of sumCols) totals[c] = round(rows.reduce((a: number, r: any) => a + Number(r[c] || 0), 0), priceDecimal);
      list = rows;
    }

    return { type: cfg.key, title: cfg.title, company_name: companyName, list, totals };
  }
}
