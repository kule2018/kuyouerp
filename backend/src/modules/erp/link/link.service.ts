import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

/**
 * 表单联动服务（对应源系统各控制器中的 getUnit / getSerial / getSuppliers / getBranch /
 * getTime / formatInfo / checkPurchase / pickinfo / planinfo / choselist 等联动方法）
 *
 * 这些接口不落库，只为前端表单提供「选择商品后带出单位价格库存」「选择源单后带出明细」
 * 「效期互算」「核销源单检查」等联动数据。所有表名硬编码白名单，取值一律参数化。
 */

/** 单位价格信息的统一返回结构 */
export interface UnitInfoResult {
  unit: any[];
  attr: any[];
  goods: any;
}

@Injectable()
export class LinkService {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  /** 执行查询（表名均为白名单硬编码，取值参数化） */
  query(sql: string, params: any[] = []) {
    return this.conn.query(sql, params);
  }

  private num(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private round(v: number, p = 4): number {
    const f = 10 ** p;
    return Math.round(v * f) / f;
  }

  /** 读取系统设置（kuyou_sets 全量，按 name 建索引） */
  private async settings(): Promise<Record<string, any>> {
    const rows = await this.query('SELECT `type`, `name`, `value`, `is_checked`, `set` FROM `kuyou_sets`');
    const out: Record<string, any> = {};
    for (const r of rows) out[r.name] = r;
    return out;
  }

  /* ==================== 商品类型树 ==================== */

  /** 商品分类树（jsTree 格式：id / parent / text / type / state） */
  async goodsTypeTree() {
    const rows = await this.query('SELECT `id`, `supplier_type_name` AS title, `pid` FROM `kuyou_goods_type`');
    return rows.map((v: any) => ({
      id: v.id,
      parent: v.pid ? v.pid : '#',
      text: String(v.title ?? ''),
      type: 'menu',
      state: false,
    }));
  }

  /* ==================== 往来单位欠款 ==================== */

  /** 供应商应付款（按主键 ID） */
  async supplierArrearsById(id: number | string) {
    if (id === undefined || id === null || id === '') return 0;
    const r = (await this.query('SELECT `need_give_account` FROM `kuyou_suppliers` WHERE `id` = ?', [id]))[0];
    return r ? this.num(r.need_give_account) : 0;
  }

  /** 供应商应付款（按供应编号） */
  async supplierArrearsByCode(code: string) {
    if (!code) return 0;
    const r = (await this.query('SELECT `need_give_account` FROM `kuyou_suppliers` WHERE `supplyer_code` = ?', [code]))[0];
    return r ? this.num(r.need_give_account) : 0;
  }

  /** 客户应收款（按客户 ID） */
  async customerArrears(id: number | string) {
    if (id === undefined || id === null || id === '') return 0;
    const r = (await this.query('SELECT `need_receive_account` FROM `kuyou_customers` WHERE `id` = ?', [id]))[0];
    return r ? this.num(r.need_receive_account) : 0;
  }

  /** 客户收货地址 */
  async receivingAddress(customersId: number | string) {
    if (!customersId) return '';
    const r = (await this.query('SELECT `getgoods_address` FROM `kuyou_customers` WHERE `id` = ?', [customersId]))[0];
    return r?.getgoods_address || '';
  }

  /* ==================== 序列号 ==================== */

  /**
   * 可选序列号列表（对应源 getSerial）
   * 取指定商品在指定仓库的「在库」序列号（store_status=1）。
   */
  async serialList(goodsCode: string, storesId: any, attributeId?: any) {
    const where: any[] = ['`store_status` = 1', '`goods_code` = ?', '`stores_id` = ?'];
    const params: any[] = [goodsCode || '', storesId];
    if (attributeId) {
      where.push('`attribute_id` = ?');
      params.push(attributeId);
    }
    const rows = await this.query(
      'SELECT `serial`, `remark`, `status` FROM `kuyou_goods_serial` WHERE ' + where.join(' AND '),
      params,
    );
    return { list: rows };
  }

  /* ==================== 批次 ==================== */

  /**
   * 商品批次列表（对应源 goods_purchase/getBranch）
   * 顺带清理已无库存的孤儿批次行，仅返回有库存的批次。
   */
  async batchList(goodsCode: string) {
    const goods = (await this.query('SELECT `batch`, `shelf_life` FROM `kuyou_goods` WHERE `goods_code` = ?', [goodsCode]))[0];
    // 清理：批次明细已生成但库存行为 0 的孤儿批次
    const batchInfoIds = await this.query('SELECT `batch_id` FROM `kuyou_goods_batch_info` WHERE `goods_code` = ?', [goodsCode]);
    const stockIds = await this.query('SELECT `batch_id` FROM `kuyou_goods_batch_stock` WHERE `goods_code` = ?', [goodsCode]);
    const stockIdSet = new Set((stockIds || []).map((r: any) => r.batch_id));
    const orphans = (batchInfoIds || []).map((r: any) => r.batch_id).filter((id: any) => !stockIdSet.has(id));
    if (orphans.length) {
      await this.query('DELETE FROM `kuyou_goods_batch` WHERE `goods_code` = ? AND `id` NOT IN (SELECT `batch_id` FROM `kuyou_goods_batch_stock` WHERE `goods_code` = ?)', [goodsCode, goodsCode]);
    }
    const ids = await this.query(
      'SELECT `batch_id` FROM `kuyou_goods_batch_stock` WHERE `goods_code` = ? AND `stock` <> 0 GROUP BY `batch_id`',
      [goodsCode],
    );
    const idList = (ids || []).map((r: any) => r.batch_id);
    let batch: any[] = [];
    if (idList.length) {
      const rows = await this.query(
        'SELECT `id`, `batch_name`, `manufacture`, `guarantee`, `validity` FROM `kuyou_goods_batch` WHERE `id` IN (?) AND `goods_code` = ?',
        [idList, goodsCode],
      );
      batch = rows.map((r: any) => ({
        ...r,
        manufacture: r.manufacture ? this.fmtDate(r.manufacture) : r.manufacture,
        validity: r.validity ? this.fmtDate(r.validity) : r.validity,
      }));
    }
    return { goods: goods || null, batch };
  }

  /* ==================== 效期互算 ==================== */

  /**
   * 生产日期 / 保质期 / 有效期互算（对应源 getTime）
   * 三选二推第三：生产+保质期→有效期；有效期+保质期→生产；生产+有效期→保质期。
   */
  calcTime(manufacture: string, shelfLife: any, validity: string) {
    const life = this.num(shelfLife);
    if (manufacture && life) {
      validity = this.dayAdd(manufacture, life);
    } else if (validity && life) {
      manufacture = this.dayAdd(validity, -life);
    } else if (validity && manufacture) {
      shelfLife = Math.ceil((this.ts(validity) - this.ts(manufacture)) / 86400);
    }
    return { manufacture, shelf_life: shelfLife, validity };
  }

  /* ==================== 商品单位 / 价格 / 库存 ==================== */

  /**
   * 商品单位价格库存联动（对应源 goods_purchase/getUnit、goods/getUnit 等）
   * 选择商品后带出：可选单位（含换算进率与基准数量）、各价格、税率、当前库存、
   * 以及辅助属性组合列表。
   *
   * @param opts.goodsCode 商品编号（优先）
   * @param opts.goodsId   商品ID（无编号时）
   * @param opts.storesId  仓库（缺省取商品默认仓库）
   * @param opts.attrId    属性组合ID
   * @param opts.supplierVat 供应商税率（覆盖系统税率）
   * @param opts.priceField 价格字段：purchase=采购价 / market_sell_price=零售价 等
   */
  async unitInfo(opts: {
    goodsCode?: string;
    goodsId?: any;
    storesId?: any;
    attrId?: any;
    supplierVat?: any;
    priceField?: string;
  }): Promise<UnitInfoResult | null> {
    const set = await this.settings();
    const taxesSet = set['taxes'] || {};
    const priceTaxes = this.num(set['price_taxes']?.is_checked);

    let row: any = null;
    if (opts.goodsCode) {
      row = (
        await this.query(
          'SELECT `batch`, `serial`, `id`, `auxiliary`, `unit_id`, `more_unit`, `more_unit_id`, `purchase`, `goods_code`, `manager_warehouse_id`, `shelf_life`, `warehousing`, `warehouse` FROM `kuyou_goods` WHERE `goods_code` = ?',
          [opts.goodsCode],
        )
      )[0];
    } else if (opts.goodsId) {
      row = (
        await this.query(
          'SELECT `batch`, `serial`, `id`, `auxiliary`, `unit_id`, `more_unit`, `more_unit_id`, `purchase`, `goods_code`, `manager_warehouse_id`, `shelf_life`, `warehousing`, `warehouse` FROM `kuyou_goods` WHERE `id` = ?',
          [opts.goodsId],
        )
      )[0];
    }
    if (!row) return null;
    const goodsId = row.id || 0;

    // 辅助属性组合
    const auxiliary = await this.query('SELECT `id`, `name` FROM `kuyou_auxiliary` WHERE `status` = 1');
    const auxName: Record<string, string> = {};
    for (const a of auxiliary) auxName[a.id] = a.name;
    const attrRows = await this.query('SELECT * FROM `kuyou_goods_attr` WHERE `goods_id` = ?', [goodsId]);
    const goodsAttr = await Promise.all(
      attrRows.map(async (v: any) => {
        const out: any = { ...v, attr_ids: [], attr_name: '' };
        const combo = v.attribute_id
          ? (await this.query('SELECT `attr_ids` FROM `kuyou_aux_combination` WHERE `id` = ?', [v.attribute_id]))[0]
          : null;
        if (combo?.attr_ids) {
          out.attr_id = combo.attr_ids;
          const ids = String(combo.attr_ids).split('&');
          out.attr_ids = ids;
          out.attr_name = ids.map((x: string) => auxName[x] || '').join('/');
        }
        return out;
      }),
    );

    // 库存
    const whereStores = opts.storesId ? opts.storesId : row.manager_warehouse_id;
    const stockRow = (
      await this.query('SELECT `stock` FROM `kuyou_goods_stock` WHERE `goods_id` = ? AND `stores_id` = ? AND (? IS NULL OR `attribute_id` = ?)', [
        goodsId,
        whereStores,
        opts.attrId ?? null,
        opts.attrId ?? null,
      ])
    )[0];
    const stock = stockRow ? this.num(stockRow.stock) : null;

    // 单位（多单位走换算表）
    let unitIds: any[] = [row.unit_id];
    let priceRows: any[] = [];
    if (this.num(row.more_unit) === 1) {
      const conv = await this.query(
        'SELECT `uc`.`vice_unit`, `u`.`name`, `u`.`id`, `uc`.`advance_rate` FROM `kuyou_unit_conversion` `uc` JOIN `kuyou_unit` `u` ON `u`.`id` = `uc`.`vice_unit` WHERE `uc`.`main_unit` = ? ORDER BY `uc`.`advance_rate` ASC',
        [row.unit_id],
      );
      for (const c of conv) unitIds.push(c.id);
      priceRows = await this.query('SELECT * FROM `kuyou_goods_price` WHERE `goods_id` = ? AND `unit` IN (?)', [goodsId, unitIds]);
      // 换算进率回填
      const rateOf: Record<string, number> = { [row.unit_id]: 1 };
      for (const c of conv) rateOf[c.id] = this.num(c.advance_rate);
      for (const p of priceRows) p.advance_rate = rateOf[p.unit] ?? 1;
    }

    const units = await this.query('SELECT `id`, `name` FROM `kuyou_unit` WHERE `id` IN (?)', [unitIds]);
    const priceOf: Record<string, any> = {};
    for (const p of priceRows) priceOf[p.unit] = p;
    const priceField = opts.priceField || 'purchase';

    const outUnits: any[] = [];
    for (const u of units) {
      const p = priceOf[u.id];
      const item: any = { id: u.id, name: u.name };
      if (p) {
        item.is_default = this.num(p.is_default);
        item[priceField] = this.num(p[priceField]);
        item.basic_nmber = this.num(p.is_default) !== 1 ? this.num(p.advance_rate) : 1;
      } else {
        // 无价格行：主单位取商品默认价
        if (u.id === row.unit_id) {
          let purchase = this.num(row.purchase);
          if (this.num(row.auxiliary) === 1 && opts.attrId) {
            const ar = (await this.query('SELECT `purchase` FROM `kuyou_goods_attr` WHERE `goods_id` = ? AND `id` = ?', [goodsId, opts.attrId]))[0];
            if (ar) purchase = this.num(ar.purchase);
          }
          item.is_default = 1;
          item.basic_nmber = 1;
          item[priceField] = purchase;
        }
      }
      // 税率
      const tax = opts.supplierVat !== undefined && opts.supplierVat !== '' ? this.num(opts.supplierVat) : this.num(taxesSet.value);
      if (this.num(taxesSet.is_checked) === 1) {
        item.tax = 1;
        item.tax_rate = tax;
      } else {
        item.tax = 0;
        item.tax_rate = 0;
      }
      const price = this.num(item[priceField]);
      if (this.num(taxesSet.is_checked) === 1 && priceTaxes === 1) {
        item[priceField] = this.round((price / (100 + tax)) * 100);
        item.tax_included = price;
      } else if (this.num(taxesSet.is_checked) === 1 && priceTaxes !== 1) {
        item[priceField] = price;
        item.tax_included = this.round((price * (100 + tax)) / 100);
      } else {
        item[priceField] = price;
        item.tax_included = price;
      }
      outUnits.push(item);
    }

    // 按单位顺序输出并计算库存
    const data: any[] = [];
    for (const id of unitIds) {
      for (const u of outUnits) {
        if (id !== u.id) continue;
        if (u.is_default === undefined) {
          u.is_default = 2;
          u.basic_nmber = 1;
        }
        u.stock = this.num(u.is_default) === 1 ? (stock === null ? 0 : stock) : this.round(this.num(stock) / this.num(u.basic_nmber), 2);
        u.tax_money = this.round(this.num(u.tax_included) - this.num(u[priceField]));
        data.push(u);
      }
    }
    return { unit: data, attr: goodsAttr, goods: row };
  }

  /* ==================== 明细行格式化计算 ==================== */

  /**
   * 明细行金额格式化（对应源 formatInfo / formatInfo2）
   * 按系统设置的小数位规整数量与价格，并计算行金额、含税单价、价税合计、折扣等。
   */
  async formatLine(data: Record<string, any>) {
    const set = await this.settings();
    const nd = this.num(set['number_decimal']?.value) || 2;
    const pd = this.num(set['price_decimal']?.value) || 4;
    const row: Record<string, any> = { ...data };
    const moneyFields = ['unit_price', 'tax_included', 'discount', 'dis_money', 'all_money', 'tax_money', 'money_tax_price'];
    const numFields = ['number', 'allow_stock', 'basic_nmber'];
    for (const k of Object.keys(row)) {
      if (numFields.includes(k)) row[k] = this.round(this.num(row[k]), nd);
      else if (moneyFields.includes(k)) row[k] = this.round(this.num(row[k]), pd);
    }
    // 基础数量 = 数量 * 换算率
    if (row.basic_nmber !== undefined && row.number !== undefined) {
      row.basic_nmber = this.round(this.num(row.number) * this.num(row.basic_nmber), nd);
    }
    // 行金额
    if (row.number !== undefined && row.unit_price !== undefined) {
      row.all_money = this.round(this.num(row.number) * this.num(row.unit_price), pd);
    }
    // 折扣
    if (row.discount !== undefined) {
      row.dis_money = this.round(this.num(row.all_money) * (this.num(row.discount) / 100), pd);
    }
    // 含税单价 / 不含税单价 / 税额 / 价税合计
    const taxes = set['taxes'] || {};
    if (this.num(taxes.is_checked) === 1) {
      const tax = this.num(taxes.value);
      if (row.tax_included !== undefined) {
        row.unit_price = this.round((this.num(row.tax_included) / (100 + tax)) * 100, pd);
      }
      if (row.unit_price !== undefined) {
        row.tax_money = this.round((this.num(row.unit_price) * tax) / 100, pd);
        row.money_tax_price = this.round(this.num(row.all_money) + this.num(row.tax_money), pd);
      }
    } else if (row.unit_price !== undefined) {
      row.money_tax_price = this.round(this.num(row.all_money), pd);
    }
    return row;
  }

  /* ==================== 源单检查（生成退换货 / 核销前） ==================== */

  /**
   * 购货单→退货单检查（对应源 goods_purchase/checkPurchase）
   * 源单必须已审核，且存在未全部退货的明细行。
   */
  async checkPurchaseReturn(orderId: number | string) {
    if (!orderId) throw new BadRequestException('参数错误');
    const row = (await this.query('SELECT `examine_status`, `purchase_code` FROM `kuyou_goods_purchase` WHERE `id` = ?', [orderId]))[0];
    if (!row) throw new BadRequestException('参数错误');
    if (this.num(row.examine_status) !== 1) throw new BadRequestException('此购货单未审核，不可生成退货单');
    const info = await this.query('SELECT * FROM `kuyou_goods_purchase_info` WHERE `purchase_code` = ?', [row.purchase_code]);
    const left: any[] = [];
    for (const v of info) {
      const r = (
        await this.query('SELECT SUM(`number`) AS `number`, SUM(`money`) AS `money` FROM `kuyou_goods_excpur_info` WHERE `purchase_id` = ? AND `type` = 2', [v.id])
      )[0];
      const done = r ? this.num(r.number) : 0;
      if (this.num(v.number) - done > 0) left.push(v);
    }
    if (!left.length) throw new BadRequestException('此购货单已全部生成退货单');
    return { code: row.purchase_code, lines: left };
  }

  /**
   * 销货单→退货单检查（对应源 goods_sales/checkPurchase）
   */
  async checkSalesReturn(orderId: number | string) {
    if (!orderId) throw new BadRequestException('参数错误');
    const row = (await this.query('SELECT `examine_status`, `purchase_code` FROM `kuyou_goods_sales` WHERE `id` = ?', [orderId]))[0];
    if (!row) throw new BadRequestException('参数错误');
    if (this.num(row.examine_status) !== 1) throw new BadRequestException('此销货单未审核，不可生成退货单');
    const info = await this.query('SELECT * FROM `kuyou_goods_sales_info` WHERE `purchase_code` = ?', [row.purchase_code]);
    const left: any[] = [];
    for (const v of info) {
      const r = (
        await this.query('SELECT SUM(`number`) AS `number` FROM `kuyou_goods_saleexc_info` WHERE `purchase_id` = ? AND `type` = 2', [v.id])
      )[0];
      const done = r ? this.num(r.number) : 0;
      if (this.num(v.number) - done > 0) left.push(v);
    }
    if (!left.length) throw new BadRequestException('此销货单已全部生成退货单');
    return { code: row.purchase_code, lines: left };
  }

  /**
   * 购货订单→购货单检查（对应源 goods_purchase_order/checkPurchase）
   * 订单须已审核，且存在未执行完的明细。
   */
  async checkOrderToPurchase(orderId: number | string) {
    if (!orderId) throw new BadRequestException('参数错误');
    const row = (await this.query('SELECT `examine_status`, `purchase_code` FROM `kuyou_goods_purchase_order` WHERE `id` = ?', [orderId]))[0];
    if (!row) throw new BadRequestException('参数错误');
    if (this.num(row.examine_status) !== 1) throw new BadRequestException('此订单未审核，不可生成购货单');
    const info = await this.query('SELECT * FROM `kuyou_goods_purchase_order_info` WHERE `purchase_code` = ?', [row.purchase_code]);
    const left: any[] = [];
    for (const v of info) {
      const r = (
        await this.query('SELECT SUM(`number`) AS `number` FROM `kuyou_goods_purord_info` WHERE `order_id` = ? AND `type` = 1', [v.id])
      )[0];
      const done = r ? this.num(r.number) : 0;
      if (this.num(v.number) - done > 0) left.push(v);
    }
    if (!left.length) throw new BadRequestException('此订单已全部生成购货单');
    return { code: row.purchase_code, lines: left };
  }

  /**
   * 销货订单→销货单检查（对应源 goods_sales_order/checkPurchase）
   */
  async checkOrderToSales(orderId: number | string) {
    if (!orderId) throw new BadRequestException('参数错误');
    const row = (await this.query('SELECT `examine_status`, `purchase_code` FROM `kuyou_goods_sales_order` WHERE `id` = ?', [orderId]))[0];
    if (!row) throw new BadRequestException('参数错误');
    if (this.num(row.examine_status) !== 1) throw new BadRequestException('此订单未审核，不可生成销货单');
    const info = await this.query('SELECT * FROM `kuyou_goods_sales_order_info` WHERE `purchase_code` = ?', [row.purchase_code]);
    const left: any[] = [];
    for (const v of info) {
      const r = (
        await this.query('SELECT SUM(`number`) AS `number` FROM `kuyou_goods_saleord_info` WHERE `order_id` = ? AND `type` = 1', [v.id])
      )[0];
      const done = r ? this.num(r.number) : 0;
      if (this.num(v.number) - done > 0) left.push(v);
    }
    if (!left.length) throw new BadRequestException('此订单已全部生成销货单');
    return { code: row.purchase_code, lines: left };
  }

  /* ==================== 生产链联动 ==================== */

  /** 补料单：按生产单号带出生产明细（type=1 为正常领料，对应源 material/pickinfo） */
  async pickInfo(purchaseCode: string, codeType: 1 | 2) {
    if (codeType === 1) {
      const plan = (await this.query('SELECT * FROM `kuyou_production` WHERE `purchase_code` = ?', [purchaseCode]))[0];
      if (!plan) throw new BadRequestException('查询失败');
      const info = await this.query('SELECT * FROM `kuyou_production_info` WHERE `production_id` = ? AND `type` = 1', [plan.id]);
      return { total: info.length, rows: info };
    }
    // 委外：展开计划的 BOM 物料
    const plan = (await this.query('SELECT * FROM `kuyou_outsourcing` WHERE `purchase_code` = ?', [purchaseCode]))[0];
    if (!plan) throw new BadRequestException('查询失败');
    const productionId = (await this.query('SELECT `id` FROM `kuyou_plan` WHERE `purchase_code` = ?', [plan.plan_code]))[0]?.id;
    const info: any[] = [];
    if (productionId) {
      const goodsList = await this.query('SELECT * FROM `kuyou_plan_info` WHERE `plan_id` = ?', [productionId]);
      for (const g of goodsList) {
        const bom = (await this.query('SELECT `id` FROM `kuyou_bom` WHERE `goods_code` = ?', [g.goods_code]))[0];
        if (!bom) continue;
        const infos = await this.query('SELECT * FROM `kuyou_bom_info` WHERE `bom_id` = ?', [bom.id]);
        info.push(...infos);
      }
    }
    return { total: info.length, rows: info };
  }

  /**
   * 验收单领料明细（对应源 Acceptance/pickinfo）
   * 与 material/pickinfo 的差异（1:1 保留源分支差异）：
   *  - code_type=1：取生产单明细且 type = 2（验收口径为产出行，material 口径为领料行 type=1）
   *  - code_type=2：委外单 → 计划单 → 直接取 `kuyou_plan_info`，不做 BOM 展开
   * @param purchaseCode 单据号
   * @param codeType     1=生产单 2=委外单（其余值归一为 1）
   * @returns { total, rows }
   */
  async acceptancePickInfo(purchaseCode: string, codeType: 1 | 2) {
    const type = codeType === 2 ? 2 : 1;
    if (type === 1) {
      const plan = (await this.query('SELECT * FROM `kuyou_production` WHERE `purchase_code` = ?', [purchaseCode]))[0];
      if (!plan) throw new BadRequestException('查询失败');
      const info = await this.query('SELECT * FROM `kuyou_production_info` WHERE `production_id` = ? AND `type` = 2', [plan.id]);
      return { total: info.length, rows: info };
    }
    const plan = (await this.query('SELECT * FROM `kuyou_outsourcing` WHERE `purchase_code` = ?', [purchaseCode]))[0];
    if (!plan) throw new BadRequestException('查询失败');
    const productionId = (await this.query('SELECT `id` FROM `kuyou_plan` WHERE `purchase_code` = ?', [plan.plan_code]))[0]?.id;
    const info = productionId
      ? await this.query('SELECT * FROM `kuyou_plan_info` WHERE `plan_id` = ?', [productionId])
      : [];
    return { total: info.length, rows: info };
  }

  /** 生产明细（对应源 material/proinfo） */
  async proInfo(purchaseCode: string) {
    const plan = (await this.query('SELECT * FROM `kuyou_production` WHERE `purchase_code` = ?', [purchaseCode]))[0];
    if (!plan) throw new BadRequestException('查询失败');
    const info = await this.query('SELECT * FROM `kuyou_production_info` WHERE `production_id` = ? AND `type` = 1', [plan.id]);
    return { total: info.length, rows: info };
  }

  /**
   * 计划→BOM 展开（对应源 productions/planinfo、outsourcing/planinfo）
   * 按计划数量放大 BOM 物料的数量 / 基础数量 / 金额。
   */
  async planBomExpand(purchaseCode: string) {
    const plan = (await this.query('SELECT * FROM `kuyou_plan` WHERE `purchase_code` = ?', [purchaseCode]))[0];
    if (!plan) throw new BadRequestException('查询失败');
    const info = await this.query('SELECT * FROM `kuyou_plan_info` WHERE `plan_id` = ?', [plan.id]);
    const data: any[] = [];
    for (const v of info) {
      const bomIds = await this.query('SELECT `id` FROM `kuyou_bom` WHERE `goods_code` = ?', [v.goods_code]);
      const idList = (bomIds || []).map((b: any) => b.id);
      if (!idList.length) continue;
      const rows = await this.query('SELECT * FROM `kuyou_bom_info` WHERE `bom_id` IN (?)', [idList]);
      for (const r of rows) {
        data.push({
          ...r,
          number: this.round(this.num(r.number) * this.num(v.number)),
          basic_nmber: this.round(this.num(r.basic_nmber) * this.num(v.number)),
          money: this.round(this.num(r.money) * this.num(v.number)),
        });
      }
    }
    return { total: data.length, rows: data };
  }

  /**
   * 上游单据明细选择（对应源 picking/choselist、plan/choseplan、productions/choselist、outsourcing/choselist）
   * 无单号时返回可分页的上游单据列表；有单号时返回该单明细（带单位富化）。
   */
  async upstreamList(docTable: string, infoTable: string, linkField: string, purchaseCode?: string, onlyAudit = false, page = 1, limit = 15) {
    if (purchaseCode) {
      const detail = (await this.query(`SELECT * FROM \`${docTable}\` WHERE \`purchase_code\` = ?`, [purchaseCode]))[0];
      const info: any[] = detail ? await this.query(`SELECT * FROM \`${infoTable}\` WHERE \`${linkField}\` = ?`, [detail.id]) : [];
      for (const v of info) {
        if (v.unit_id) {
          v.unit = (await this.query('SELECT * FROM `kuyou_unit` WHERE `id` = ?', [v.unit_id]))[0] || null;
        }
      }
      return { total: info.length, rows: info };
    }
    // 列表模式
    const where = onlyAudit ? 'WHERE `examine_status` = 1' : '';
    const total = (await this.query(`SELECT COUNT(*) AS \`total\` FROM \`${docTable}\` ${where}`))[0]?.total || 0;
    const rows = await this.query(
      `SELECT * FROM \`${docTable}\` ${where} ORDER BY \`id\` DESC LIMIT ? OFFSET ?`,
      [limit, (page - 1) * limit],
    );
    return { total, rows };
  }

  /* ==================== 盘点联动 ==================== */

  /**
   * 盘点单→盘盈/盘亏单提示（对应源 Warehousing/checkInventory）
   * 按盘点明细的盈亏方向返回可生成的单据类型。
   */
  async checkInventory(purchaseCode: string, type: number) {
    const out: any[] = [];
    if (type === 1) {
      const info = await this.query('SELECT * FROM `kuyou_inventory_info` WHERE `purchase_code` = ?', [purchaseCode]);
      let py = false;
      let pk = false;
      for (const v of info) {
        if (this.num(v.profit) > 0) py = true;
        else if (this.num(v.profit) < 0) pk = true;
      }
      if (py) out.push({ type: 1, purchase_code: purchaseCode, status: 1, title: '盘盈单' });
      if (pk) out.push({ type: 1, purchase_code: purchaseCode, status: 2, title: '盘亏单' });
    }
    return out;
  }

  /* ==================== 辅助属性组合 ==================== */

  /**
   * 辅助属性笛卡尔组合（对应源 goods/auxiliary）
   * 按选定的一级属性与二级属性生成全部规格组合。
   */
  async auxiliaryCombine(typearr: any[], typesarr: any[], code: string) {
    const parents = await this.query('SELECT * FROM `kuyou_auxiliary` WHERE `id` IN (?)', [typearr || []]);
    const specName: any[] = [];
    for (const p of parents) {
      const spec = await this.query('SELECT `name`, `id` FROM `kuyou_auxiliary` WHERE `pid` = ? AND `id` IN (?)', [p.id, typesarr || []]);
      specName.push({ ...p, spec });
    }
    // 笛卡尔积
    let lists: any[] = [{}];
    for (const p of specName) {
      const next: any[] = [];
      for (const base of lists) {
        for (const s of p.spec) {
          next.push({ ...base, [p.id]: s });
        }
      }
      lists = next;
    }
    const out = lists.map((item: any, idx: number) => {
      const specs = Object.values(item) as any[];
      const names = specs.map((s: any) => s.name);
      const ids = specs.map((s: any) => String(s.id));
      return {
        ...item,
        // 源 combineDeka 产出：id 为 & 拼接串，spec_id 为其拆分数组，spec_arr 为 / 拼接
        id: ids.join('&'),
        code: `${code}_${idx + 1}`,
        spec_name: names.join('/'),
        spec_id: ids,
        spec_arr: ids.join('/'),
      };
    });
    return { lists: out, spec_name: specName };
  }

  /* ==================== 核销源单选择 ==================== */

  /**
   * 核销单选源单（对应源 Writeoff::choselist / chosereceivable / chosecopewith / choseadvancelist）
   * 四类选择本质相同：按往来单位 + 业务类型集合过滤 kuyou_writeoff_source，
   * 排除已核销完的源单，再按 type 翻译单据类型中文名，并回填核销日志的已核金额。
   *
   * @param kind  list=收款源单 / receivable=应收 / copewith=应付 / advancelist=预付
   * @param partyId 客户或供应商主键（advancelist 与 copewith 传供应商 ID）
   */
  async writeoffSource(kind: string, partyId: any, filter: Record<string, any> = {}): Promise<{ total: number; rows: any[] }> {
    const where: string[] = [];
    const params: any[] = [];
    let typeLabel = '';

    if (kind === 'list') {
      where.push('`customers_id` = ?');
      params.push(partyId);
      where.push('`purchase_type` IN (1, 6)');
      typeLabel = '收款';
    } else if (kind === 'receivable') {
      where.push('`customers_id` = ?');
      params.push(partyId);
      where.push('`purchase_type` IN (3, 5)');
    } else if (kind === 'advancelist') {
      const sup = (await this.query('SELECT `supplyer_code` FROM `kuyou_suppliers` WHERE `id` = ?', [partyId]))[0];
      where.push('`suppliers_code` = ?');
      params.push(sup ? sup.supplyer_code : '');
      where.push('`purchase_type` IN (2, 6)');
      typeLabel = '付款';
    } else if (kind === 'copewith') {
      const sup = (await this.query('SELECT `supplyer_code` FROM `kuyou_suppliers` WHERE `id` = ?', [partyId]))[0];
      where.push('`suppliers_code` = ?');
      params.push(sup ? sup.supplyer_code : '');
      where.push('`purchase_type` IN (4, 5)');
    } else {
      throw new BadRequestException('参数错误');
    }

    // 时间区间与单号模糊过滤（源 filter 为 JSON）
    if (!this.empty(filter.purchase_time)) {
      const seg = String(filter.purchase_time).split(' - ');
      where.push('`purchase_time` BETWEEN ? AND ?');
      params.push(this.ts(seg[0]), this.ts(seg[1] ?? seg[0]));
    }
    if (!this.empty(filter.purchase_code)) {
      where.push('`purchase_code` LIKE ?');
      params.push(`%${filter.purchase_code}%`);
    }
    // 排除已核销完：未被核销记录引用，或对应记录仍有未核销金额
    where.push(
      '(`id` NOT IN (SELECT `source_id` FROM `kuyou_writeoff_log`) OR `id` IN (SELECT `source_id` FROM `kuyou_writeoff_log` WHERE `write_off` <> 0))',
    );

    const rows = await this.query(
      `SELECT * FROM \`kuyou_writeoff_source\` WHERE ${where.join(' AND ')} ORDER BY \`purchase_type\` DESC, \`purchase_time\` ASC`,
      params,
    );
    const out: any[] = [];
    for (const v of rows) {
      const log = (await this.query('SELECT `money`, `write_off` FROM `kuyou_writeoff_log` WHERE `source_id` = ?', [v.id]))[0];
      const item: any = {
        ...v,
        money_tax_price: v.price,
        pay_money: v.money,
        money: v.write_off,
        purchase_type_id: v.id,
        purchase_codes: v.purchase_code,
        purchase_time: v.purchase_time ? this.fmtDate(v.purchase_time) : v.purchase_time,
        remark: v.remark,
        type: v.type,
      };
      if (this.num(v.purchase_type) > 4) {
        item.purchase_type = '期初余额';
        item.purchase_code = '期初余额';
      } else if (kind === 'receivable') {
        if (this.num(v.type) === 1) item.purchase_type = '普通销售';
        else if (this.num(v.type) === 4) item.purchase_type = '核销';
        else item.purchase_type = '销售退货';
      } else if (kind === 'copewith') {
        item.purchase_type = this.num(v.type) === 1 ? '普通购货' : '购货退货';
      } else {
        item.purchase_type = typeLabel;
      }
      if (log) {
        item.money = log.write_off;
        item.pay_money = log.money;
      } else {
        item.pay_money = 0;
      }
      out.push(item);
    }
    return { total: out.length, rows: out };
  }

  /* ==================== 商品选择弹窗 ==================== */

  /**
   * 弹窗选择商品（对应源 Goods::chosegoods / getGoods）
   * 按关键字（编号/名称/条码）与分类过滤启用商品，启用辅助属性时按属性组合展开行，
   * 并富化单位与分类名称；分页在内存中按展开后的行做切片（与源一致）。
   */
  async choseGoods(opts: {
    keyword?: string;
    goodsName?: string;
    typeIds?: any[];
    page?: number;
    limit?: number;
  }): Promise<{ total: number; rows: any[] }> {
    const where: string[] = ['`status` = 1'];
    const params: any[] = [];
    const kw = opts.goodsName || opts.keyword;
    if (!this.empty(kw)) {
      where.push('(`goods_code` LIKE ? OR `goods_name` LIKE ? OR `goods_barcode` LIKE ?)');
      params.push(`%${kw}%`, `%${kw}%`, `%${kw}%`);
    }
    if (opts.typeIds && opts.typeIds.length) {
      where.push('`goods_type_id` IN (?)');
      params.push(opts.typeIds);
    }
    const goods = await this.query(`SELECT * FROM \`kuyou_goods\` WHERE ${where.join(' AND ')}`, params);
    const auxSet = (await this.query("SELECT `is_checked` FROM `kuyou_sets` WHERE `name` = 'auxiliary'"))[0];
    const useAux = this.num(auxSet?.is_checked) === 1;

    const list: any[] = [];
    for (const g of goods) {
      const base: any = { ...g, goods_attr: '', attr_code: '', attr_name: '', stock: g.inventory, number: '' };
      list.push(base);
      if (useAux && this.num(g.auxiliary) === 1) {
        const attrs = await this.query('SELECT `id`, `attribute_id`, `attr_code` FROM `kuyou_goods_attr` WHERE `goods_code` = ?', [g.goods_code]);
        for (const a of attrs) {
          const combo = (await this.query('SELECT `attr_ids` FROM `kuyou_aux_combination` WHERE `id` = ?', [a.attribute_id]))[0];
          if (!combo?.attr_ids) continue;
          const ids = String(combo.attr_ids).split('&');
          const aux = await this.query('SELECT `name` FROM `kuyou_auxiliary` WHERE `id` IN (?)', [ids]);
          list.push({
            ...g,
            stock: '',
            attr_code: a.attr_code,
            goods_attr: a.id,
            attr_name: aux.map((x: any) => x.name).join('/'),
            number: '',
          });
        }
      }
    }

    // 内存分页（源同样先全量展开再切片）
    const page = Number(opts.page) || 1;
    const limit = Number(opts.limit) || 10;
    const slice = list.slice((page - 1) * limit, page * limit);
    for (const row of slice) {
      const unit = (await this.query('SELECT `id`, `name` FROM `kuyou_unit` WHERE `id` = ?', [row.unit_id]))[0];
      row.unit = unit || { id: '', name: '' };
      const type = (await this.query('SELECT `id`, `supplier_type_name` AS `name` FROM `kuyou_goods_type` WHERE `id` = ?', [row.goods_type_id]))[0];
      row.goods_type = type || null;
    }
    return { total: list.length, rows: slice };
  }

  /* ==================== 序列号录入 ==================== */

  /**
   * 序列号串处理（对应源 Goods::period / InventorySerial::period）
   * - 传 period_period：反序列化回对象数组原样返回
   * - 传 chose_serial：把选中的序列号数组包装成 [{serial, remark}]
   * - 传 stock.serial + stock.remark：同上（前端表格提交形态）
   * 返回 { num, ser }，ser 为数组（目标端不再使用 PHP serialize）
   */
  serialPeriod(payload: Record<string, any>): { num: number; ser: any[] } {
    if (payload.period_period !== undefined) {
      const ser = Array.isArray(payload.period_period)
        ? payload.period_period
        : this.parseSerial(payload.period_period);
      return { num: ser.length, ser };
    }
    if (payload.chose_serial !== undefined) {
      const arr: any[] = Array.isArray(payload.chose_serial) ? payload.chose_serial : String(payload.chose_serial).split(',');
      const ser = arr.filter((x) => x !== '').map((x) => ({ serial: x, remark: '' }));
      return { num: ser.length, ser };
    }
    const stock = payload.stock || {};
    const serials: any[] = Array.isArray(stock.serial) ? stock.serial : [];
    const remarks: any[] = Array.isArray(stock.remark) ? stock.remark : [];
    const ser: any[] = [];
    serials.forEach((v: any, k: number) => {
      if (v === '' || v === null || v === undefined) return;
      ser.push({ serial: v, remark: remarks[k] ?? '' });
    });
    return { num: ser.length, ser };
  }

  /** 序列号串解析：JSON 数组或 & / , 分隔 */
  private parseSerial(raw: any): any[] {
    if (Array.isArray(raw)) return raw;
    const s = String(raw ?? '');
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      /* 非 JSON，按分隔符处理 */
    }
    return s
      .split(/[&,\s]+/)
      .filter((x) => x !== '')
      .map((x) => ({ serial: x, remark: '' }));
  }

  /* ==================== 订单转退换货检查 ==================== */

  /**
   * 订单生成退换货单前的检查（对应源 *_order/checkExchange）
   * 与生成单据的 checkPurchase 类似，但退换货目标表不同（kuyou_goods_excpur_info / kuyou_goods_saleexc_info），
   * 且「是否需要审核」受系统 examine 开关控制。
   */
  async checkExchange(orderTable: string, infoTable: string, doneTable: string, orderId: any) {
    if (!orderId) throw new BadRequestException('参数错误');
    const row = (await this.query(`SELECT \`examine_status\`, \`purchase_code\` FROM \`${orderTable}\` WHERE \`id\` = ?`, [orderId]))[0];
    if (!row) throw new BadRequestException('参数错误');
    const examine = (await this.query("SELECT `is_checked` FROM `kuyou_sets` WHERE `name` = 'examine'"))[0];
    if (this.num(examine?.is_checked) === 1 && this.num(row.examine_status) !== 1) {
      throw new BadRequestException('此订单未审核，不可生成退货单');
    }
    const info = await this.query(`SELECT * FROM \`${infoTable}\` WHERE \`purchase_code\` = ?`, [row.purchase_code]);
    const left: any[] = [];
    for (const v of info) {
      const r = (
        await this.query(`SELECT SUM(\`number\`) AS \`number\` FROM \`${doneTable}\` WHERE \`purchase_id\` = ? AND \`type\` = 1`, [v.id])
      )[0];
      const done = r ? this.num(r.number) : 0;
      if (this.num(v.number) - done > 0) left.push(v);
    }
    if (!left.length) throw new BadRequestException('此订单已全部生成退货单');
    return { code: row.purchase_code, lines: left };
  }

  /* ==================== 工具 ==================== */

  /** 判断单元格是否为空（与源 empty() 语义一致：0 与 '' 均视为空） */
  private empty(v: any): boolean {
    return v === undefined || v === null || v === '' || v === '0' || v === 0;
  }

  /** 时间戳 → YYYY-MM-DD（本地时区，与源 date() 一致） */
  private fmtDate(ts: any): string {
    const d = new Date(this.num(ts) * 1000);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /** 日期字符串 → 秒级时间戳（本地零头，避免 UTC 偏移） */
  private ts(date: string): number {
    return Math.floor(new Date(`${String(date).slice(0, 10)}T00:00:00`).getTime() / 1000);
  }

  /** 日期 ± n 天 → YYYY-MM-DD */
  private dayAdd(date: string, days: number): string {
    const d = new Date(this.ts(date) * 1000 + days * 86400 * 1000);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
}
