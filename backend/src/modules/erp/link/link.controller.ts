import { Controller, Get, Post, Query, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { LinkService } from './link.service';
import { ok, table } from '../../../common/utils/resp';

/**
 * 表单联动控制器
 *
 * 路由与源 kuyou 系统的前端调用路径逐一对应（kuyou/<模块>/<方法>），
 * 供单据 / 基础资料表单的「选商品带出单位价格库存」「选源单带出明细」
 * 「效期互算」「源单检查」等联动使用。
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class LinkController {
  constructor(private readonly svc: LinkService) {}

  /* ---------------- 商品 ---------------- */

  /** 商品分类树 */
  @Get('goods/gettype')
  async getType() {
    return this.svc.goodsTypeTree();
  }

  /** 供应商应付款（按ID） */
  @Get('goods/getSuppliers/:supplyer_id')
  async getSupplierById(@Param('supplyer_id') id: string) {
    return this.svc.supplierArrearsById(id);
  }

  /** 商品单位价格库存（ Goods::getUnit，零售价字段） */
  @Get('goods/getUnit')
  async getGoodsUnit(@Query() q: any) {
    const r = await this.svc.unitInfo({
      goodsCode: q.goods_code,
      goodsId: q.goods_id,
      storesId: q.store,
      attrId: q.attr,
      priceField: q.price_field || 'market_sell_price',
    });
    return r || [];
  }

  /** 销售单位价格（按客户等级取价，对应源 Goods::getSaleUnit） */
  @Get('goods/getSaleUnit')
  async getSaleUnit(@Query() q: any) {
    // 客户等级决定价格字段：1=零售价 2=批发价 3=会员价（与源逻辑一致）
    let priceField = 'market_sell_price';
    if (q.customers_id) {
      const c = await this.svc.query('SELECT `customerlevel_id` FROM `kuyou_customers` WHERE `id` = ?', [q.customers_id]);
      const level = c[0] ? Number(c[0].customerlevel_id) : 0;
      if (level === 2) priceField = 'wholesale_price';
      else if (level === 3) priceField = 'vip_price';
    }
    const r = await this.svc.unitInfo({
      goodsCode: q.goods_code,
      goodsId: q.goods_id,
      storesId: q.store,
      attrId: q.attr,
      priceField,
    });
    return r || [];
  }

  /** 可选序列号 */
  @Get('goods/getSerial')
  async getSerial(@Query() q: any) {
    return this.svc.serialList(q.goods_code, q.stores_id, q.attribute_id);
  }

  /** 辅助属性组合 */
  @Post('goods/auxiliary')
  async auxiliary(@Body() body: any) {
    return ok(await this.svc.auxiliaryCombine(body.typearr, body.typesarr, body.code || ''));
  }

  /* ---------------- 购货 ---------------- */

  /** 购货商品单位价格库存（采购价字段） */
  @Get('goods_purchase/getUnit')
  async purchaseGetUnit(@Query() q: any) {
    let supplierVat: any = '';
    if (q.supplyer_code) {
      const r = (await this.svc.query('SELECT `vat_rate` FROM `kuyou_suppliers` WHERE `supplyer_code` = ?', [q.supplyer_code]))[0];
      supplierVat = r ? r.vat_rate : '';
    }
    const res = await this.svc.unitInfo({
      goodsCode: q.goods_code,
      goodsId: q.goods_id,
      storesId: q.store,
      attrId: q.attr,
      supplierVat,
      priceField: 'purchase',
    });
    return res || [];
  }

  /** 供应商应付款（按供应编号） */
  @Get('goods_purchase/getSuppliers/:supplyer_code')
  async purchaseGetSupplier(@Param('supplyer_code') code: string) {
    return this.svc.supplierArrearsByCode(code);
  }

  /** 商品批次列表 */
  @Get('goods_purchase/getBranch/:goods_code')
  async getBranch(@Param('goods_code') goodsCode: string) {
    return this.svc.batchList(goodsCode);
  }

  /** 效期互算 */
  @Get('goods_purchase/getTime')
  async getTime(@Query() q: any) {
    return this.svc.calcTime(q.manufacture, q.shelf_life, q.validity);
  }

  /** 明细行格式化（购货） */
  @Post('goods_purchase/formatInfo')
  async purchaseFormatInfo(@Body() body: any) {
    return this.svc.formatLine(body);
  }

  /** 购货单→退货单检查 */
  @Post('goods_purchase/checkPurchase')
  async purchaseCheck(@Body() body: any) {
    return ok(await this.svc.checkPurchaseReturn(body.exchange));
  }

  /** 购货订单→购货单检查 */
  @Post('goods_purchase_order/checkPurchase')
  async purchaseOrderCheck(@Body() body: any) {
    return ok(await this.svc.checkOrderToPurchase(body.exchange));
  }

  /* ---------------- 销货 ---------------- */

  /** 销货商品单位价格库存 */
  @Get('goods_sales/getUnit')
  async salesGetUnit(@Query() q: any) {
    const res = await this.svc.unitInfo({
      goodsCode: q.goods_code,
      goodsId: q.goods_id,
      storesId: q.store,
      attrId: q.attr,
      priceField: q.price_field || 'market_sell_price',
    });
    return res || [];
  }

  /** 销货商品单位（简化版，对应源 GoodsSales::getUnits） */
  @Get('goods_sales/getUnits')
  async salesGetUnits(@Query() q: any) {
    const res = await this.svc.unitInfo({
      goodsCode: q.goods_code,
      goodsId: q.goods_id,
      storesId: q.store,
      priceField: q.price_field || 'market_sell_price',
    });
    return res || [];
  }

  /** 客户应收款 */
  @Get('goods_sales/getSuppliers/:customers_id')
  async salesGetCustomer(@Param('customers_id') id: string) {
    return this.svc.customerArrears(id);
  }

  /** 销货批次列表 */
  @Get('goods_sales/getBranch/:goods_code')
  async salesGetBranch(@Param('goods_code') goodsCode: string) {
    return this.svc.batchList(goodsCode);
  }

  /** 效期互算 */
  @Get('goods_sales/getTime')
  async salesGetTime(@Query() q: any) {
    return this.svc.calcTime(q.manufacture, q.shelf_life, q.validity);
  }

  /** 明细行格式化（销货） */
  @Post('goods_sales/formatInfo2')
  async salesFormatInfo(@Body() body: any) {
    return this.svc.formatLine(body);
  }

  /** 销货单→退货单检查 */
  @Post('goods_sales/checkPurchase')
  async salesCheck(@Body() body: any) {
    return ok(await this.svc.checkSalesReturn(body.exchange));
  }

  /** 销货订单→销货单检查 */
  @Post('goods_sales_order/checkPurchase')
  async salesOrderCheck(@Body() body: any) {
    return ok(await this.svc.checkOrderToSales(body.exchange));
  }

  /** 客户收货地址 */
  @Get('goods_sales/getReceivingAddress')
  async receivingAddress(@Query() q: any) {
    return this.svc.receivingAddress(q.customers_id);
  }

  /* ---------------- 换货 / 库存 ---------------- */

  /** 换货序列号 */
  @Get('goods_exchange/getSerial')
  async exchangeSerial(@Query() q: any) {
    return this.svc.serialList(q.goods_code, q.stores_id, q.attribute_id);
  }

  /** 换货供应商欠款 */
  @Get('goods_exchange/getSuppliers/:supplyer_code')
  async exchangeSupplier(@Param('supplyer_code') code: string) {
    return this.svc.supplierArrearsByCode(code);
  }

  /** 调拨单位 */
  @Get('allocation/getUnit')
  async allocationUnit(@Query() q: any) {
    const res = await this.svc.unitInfo({ goodsCode: q.goods_code, goodsId: q.goods_id, storesId: q.store, attrId: q.attr, priceField: 'purchase' });
    return res || [];
  }

  /** 调拨序列号 */
  @Get('allocation/getSerial')
  async allocationSerial(@Query() q: any) {
    return this.svc.serialList(q.goods_code, q.stores_id, q.attribute_id);
  }

  /** 其他出库序列号 */
  @Get('warehouse/getSerial')
  async warehouseSerial(@Query() q: any) {
    return this.svc.serialList(q.goods_code, q.stores_id, q.attribute_id);
  }

  /** 序列号盘点序列号 */
  @Get('inventory_serial/getSerial')
  async inventorySerial(@Query() q: any) {
    return this.svc.serialList(q.goods_code, q.stores_id, q.attribute_id);
  }

  /** 盘点→盘盈盘亏提示 */
  @Get('Warehousing/checkInventory')
  async checkInventory(@Query() q: any) {
    return this.svc.checkInventory(q.purchase_code, Number(q.type) || 1);
  }

  /* ---------------- 生产链 ---------------- */

  /** 补料单来源明细 */
  @Get('material/pickinfo')
  async pickInfo(@Query() q: any) {
    const r = await this.svc.pickInfo(q.purchase_code, Number(q.code_type) === 2 ? 2 : 1);
    return table(r.total, r.rows);
  }

  /** 验收单领料明细（源 Acceptance/pickinfo，大小写两种写法都支持） */
  @Get('acceptance/pickinfo')
  async acceptancePickInfo(@Query() q: any) {
    const r = await this.svc.acceptancePickInfo(q.purchase_code, Number(q.code_type) === 2 ? 2 : 1);
    return table(r.total, r.rows);
  }

  @Get('Acceptance/pickinfo')
  async acceptancePickInfoCamel(@Query() q: any) {
    return this.acceptancePickInfo(q);
  }

  /** 生产明细 */
  @Get('material/proinfo')
  async proInfo(@Query() q: any) {
    const r = await this.svc.proInfo(q.purchase_code);
    return table(r.total, r.rows);
  }

  /** 生产单：计划 BOM 展开 */
  @Get('productions/planinfo')
  async productionsPlanInfo(@Query() q: any) {
    const r = await this.svc.planBomExpand(q.purchase_code);
    return table(r.total, r.rows);
  }

  /** 委外单：计划 BOM 展开 */
  @Get('outsourcing/planinfo')
  async outsourcingPlanInfo(@Query() q: any) {
    const r = await this.svc.planBomExpand(q.purchase_code);
    return table(r.total, r.rows);
  }

  /** 领料单：上游生产单明细 */
  @Get('picking/choselist')
  async pickingChoseList(@Query() q: any) {
    const r = await this.svc.upstreamList('kuyou_picking', 'kuyou_picking_info', 'production_id', q.purchase_code, false, Number(q.page) || 1, Number(q.limit) || 15);
    return q.purchase_code ? table(r.total, r.rows) : table(r.total, r.rows);
  }

  /** 生产单：上游计划明细 */
  @Get('productions/choselist')
  async productionsChoseList(@Query() q: any) {
    const r = await this.svc.upstreamList('kuyou_plan', 'kuyou_plan_info', 'plan_id', q.purchase_code, true, Number(q.page) || 1, Number(q.limit) || 15);
    return table(r.total, r.rows);
  }

  /** 委外单：上游计划明细 */
  @Get('outsourcing/choselist')
  async outsourcingChoseList(@Query() q: any) {
    const r = await this.svc.upstreamList('kuyou_plan', 'kuyou_plan_info', 'plan_id', q.purchase_code, true, Number(q.page) || 1, Number(q.limit) || 15);
    return table(r.total, r.rows);
  }

  /** 计划选择 */
  @Get('plan/choseplan')
  async planChosePlan(@Query() q: any) {
    const r = await this.svc.upstreamList('kuyou_plan', 'kuyou_plan_info', 'plan_id', q.purchase_code, true, Number(q.page) || 1, Number(q.limit) || 15);
    return table(r.total, r.rows);
  }

  /* ---------------- 核销源单选择 ---------------- */

  /** 核销单：选择收款源单（预收冲应收） */
  @Get('writeoff/choselist')
  async writeoffChoseList(@Query() q: any) {
    const r = await this.svc.writeoffSource('list', q.customers_id, this.parseFilter(q.filter));
    return table(r.total, r.rows);
  }

  /** 核销单：选择应收单据 */
  @Get('writeoff/chosereceivable')
  async writeoffChoseReceivable(@Query() q: any) {
    const r = await this.svc.writeoffSource('receivable', q.customers_id, this.parseFilter(q.filter));
    return table(r.total, r.rows);
  }

  /** 核销单：选择应付单据 */
  @Get('writeoff/chosecopewith')
  async writeoffChoseCopewith(@Query() q: any) {
    const r = await this.svc.writeoffSource('copewith', q.suppliers_id, this.parseFilter(q.filter));
    return table(r.total, r.rows);
  }

  /** 核销单：选择预付单据 */
  @Get('writeoff/choseadvancelist')
  async writeoffChoseAdvance(@Query() q: any) {
    const r = await this.svc.writeoffSource('advancelist', q.suppliers_id, this.parseFilter(q.filter));
    return table(r.total, r.rows);
  }

  /* ---------------- 商品选择弹窗 ---------------- */

  /** 弹窗选择商品（大小写两种写法都支持，源前端混用） */
  @Get('goods/chosegoods')
  async choseGoods(@Query() q: any) {
    return this.doChoseGoods(q);
  }

  @Get('goods/choseGoods')
  async choseGoodsCamel(@Query() q: any) {
    return this.doChoseGoods(q);
  }

  @Get('goods/getGoods')
  async getGoods(@Query() q: any) {
    return this.doChoseGoods(q);
  }

  /** 销售商品选择（可带客户价，与源 chosesale 一致走同一份商品列表） */
  @Get('goods/chosesale')
  async choseSale(@Query() q: any) {
    return this.doChoseGoods(q);
  }

  private async doChoseGoods(q: any) {
    const filter = this.parseFilter(q.filter);
    const r = await this.svc.choseGoods({
      keyword: filter.keyword || q.keyword,
      goodsName: q.goods_name,
      typeIds: this.toArray(filter.type || q.type),
      page: Number(q.page) || 1,
      limit: Number(q.limit) || 10,
    });
    return table(r.total, r.rows);
  }

  /* ---------------- 序列号录入 ---------------- */

  /** 商品序列号串处理（源 Goods::period） */
  @Post('goods/period')
  async goodsPeriod(@Body() body: any) {
    return this.svc.serialPeriod(body || {});
  }

  /** 序列号盘点单的序列号串处理（源 InventorySerial::period） */
  @Post('inventory_serial/period')
  async inventorySerialPeriod(@Body() body: any) {
    return this.svc.serialPeriod(body || {});
  }

  /* ---------------- 订单转退换货检查 ---------------- */

  /** 购货订单 → 购货退货单检查 */
  @Post('goods_purchase_order/checkExchange')
  async purchaseOrderCheckExchange(@Body() body: any) {
    return this.svc.checkExchange(
      'kuyou_goods_purchase_order',
      'kuyou_goods_purchase_order_info',
      'kuyou_goods_excpur_info',
      body.order_id ?? body.id,
    );
  }

  /** 销货订单 → 销货退货单检查 */
  @Post('goods_sales_order/checkExchange')
  async salesOrderCheckExchange(@Body() body: any) {
    return this.svc.checkExchange(
      'kuyou_goods_sales_order',
      'kuyou_goods_sales_order_info',
      'kuyou_goods_saleexc_info',
      body.order_id ?? body.id,
    );
  }

  /* ---------------- 明细行格式化别名 ---------------- */

  /** 其他入库单明细格式化（源 Warehousing/formatInfo） */
  @Post('Warehousing/formatInfo')
  async warehousingFormatInfo(@Body() body: any) {
    return this.svc.formatLine(body || {});
  }

  /** 购货单明细格式化（源 goods_purchase/formatInfo2，与 formatInfo 同一套规则） */
  @Post('goods_purchase/formatInfo2')
  async purchaseFormatInfo2(@Body() body: any) {
    return this.svc.formatLine(body || {});
  }

  /* ---------------- 工具 ---------------- */

  /** filter 参数可能是 JSON 字符串（源前端 json 序列化后提交） */
  private parseFilter(v: any): Record<string, any> {
    if (!v) return {};
    if (typeof v === 'object') return v;
    try {
      return JSON.parse(String(v));
    } catch (e) {
      return {};
    }
  }

  /** 逗号分隔或数组 → 数组 */
  private toArray(v: any): any[] {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    return String(v)
      .split(',')
      .filter((x) => x !== '');
  }
}

