import { Controller, Get, Post, Query, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RetailService } from './retail.service';
import { DocumentService } from '../document/document.service';
import { DynamicCrudService } from '../dynamic-crud/dynamic-crud.service';
import { DOCUMENT_CONFIGS } from '../document/document.config';
import { ok, table } from '../../../common/utils/resp';

/** 取文档配置（header 表 + fixedFilter），无配置抛错 */
function docMeta(docType: string) {
  const c = DOCUMENT_CONFIGS[docType];
  if (!c) throw new BadRequestException(`单据未注册: ${docType}`);
  return c;
}

/**
 * 零售收银台控制器（源 retail/GoodsSales.php）
 *
 * 路由与源 kuyou 前端调用路径逐一对应：
 *  - GET  retail/goods_sales/init          收银台初始化（目标端 convenience，源为视图赋值）
 *  - POST retail/goods_sales/getGoodsList  商品网格
 *  - POST retail/goods_sales/add           POS 结算（types=ls）/ 零售单保存
 *  - POST retail/goods_sales/examine        零售单审核 / 反审核（examine=1|2）
 *  - GET  retail/goods_sales/index          零售单列表（order_type=2，富化 returns_order_id）
 *  - POST retail/goods_sales/edit          零售单编辑（主从保存）
 *  - POST retail/goods_sales/del           零售单删除（软删）
 *  - GET/POST retail/goods_sales_exchange/* 零售退货单：index/add/edit/del/examine
 *
 * 零售单与退货单分别复用文档引擎 kuyou_retail_sales / kuyou_retail_sales_exchange
 * （物理表 kuyou_goods_sales / kuyou_goods_sales_exchange，fixedFilter order_type=2）。
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class RetailController {
  constructor(
    private readonly svc: RetailService,
    private readonly doc: DocumentService,
    private readonly crud: DynamicCrudService,
  ) {}

  /** 收银台初始化：公司名 / 结算账户 / 小数位 */
  @Get('retail/goods_sales/init')
  async init() {
    return ok(await this.svc.posInit());
  }

  /** 商品网格（源 getGoodsList，POST） */
  @Post('retail/goods_sales/getGoodsList')
  async getGoodsList(@Body() body: any) {
    return ok(await this.svc.getGoodsList(body || {}));
  }

  /**
   * POS 结算 / 零售单保存（源 add）
   * types=ls 为收银台结算（双单号 + 写单 + 自动过账）；
   * 其余为零售单主从保存，转单据引擎（目标端 document.vue 走 kuyou_retail_sales/save，
   * 此处保留源 URL 形态，body 为 { header, lines }）。
   */
  @Post('retail/goods_sales/add')
  async add(@Body() body: any, @CurrentUser() user: any) {
    if (body && body.types === 'ls') {
      return ok(await this.svc.checkout(body, user), '结算成功');
    }
    return ok(await this.doc.saveDoc('kuyou_retail_sales', body || {}, user), '保存成功');
  }

  /** 零售单审核 / 反审核（源 examine?examine=1|2&ids=） */
  @Post('retail/goods_sales/examine')
  async examine(@Query() q: any, @CurrentUser() user: any) {
    const state: 0 | 1 = Number(q.examine) === 2 ? 0 : 1;
    return ok(await this.svc.examineRetail(String(q.ids || ''), state, user), state === 1 ? '审核成功' : '反审核成功');
  }

  /**
   * 零售单列表（源 index）
   * 复用文档引擎 list（kuyou_retail_sales → kuyou_goods_sales + order_type=2 固定过滤），
   * 并富化退货关联单号 returns_order_id。
   */
  @Get('retail/goods_sales/index')
  async index(@Query() q: any) {
    const c = docMeta('kuyou_retail_sales');
    const r = await this.crud.list(c.header, { ...(q || {}), extraFilter: c.fixedFilter });
    await this.svc.enrichReturnsOrderId(r.rows);
    return table(r);
  }

  /** 零售单编辑（源 edit，body 带主键即更新模式） */
  @Post('retail/goods_sales/edit')
  async edit(@Body() body: any, @CurrentUser() user: any) {
    return ok(await this.doc.saveDoc('kuyou_retail_sales', body || {}, user), '保存成功');
  }

  /** 零售单删除（源 del，软删） */
  @Post('retail/goods_sales/del')
  async del(@Body() body: any) {
    const ids = body?.ids || body?.id || '';
    return ok(await this.crud.del('kuyou_goods_sales', String(ids)));
  }

  /* ---------------- 零售退货单（goods_sales_exchange） ---------------- */

  /** 零售退货单列表（源 GoodsSalesExchange::index） */
  @Get('retail/goods_sales_exchange/index')
  async exchangeIndex(@Query() q: any) {
    const c = docMeta('kuyou_retail_sales_exchange');
    const r = await this.crud.list(c.header, { ...(q || {}), extraFilter: c.fixedFilter });
    return table(r);
  }

  /** 零售退货单新增（源 add） */
  @Post('retail/goods_sales_exchange/add')
  async exchangeAdd(@Body() body: any, @CurrentUser() user: any) {
    return ok(await this.doc.saveDoc('kuyou_retail_sales_exchange', body || {}, user), '保存成功');
  }

  /** 零售退货单编辑（源 edit） */
  @Post('retail/goods_sales_exchange/edit')
  async exchangeEdit(@Body() body: any, @CurrentUser() user: any) {
    return ok(await this.doc.saveDoc('kuyou_retail_sales_exchange', body || {}, user), '保存成功');
  }

  /** 零售退货单删除（源 del，软删） */
  @Post('retail/goods_sales_exchange/del')
  async exchangeDel(@Body() body: any) {
    const ids = body?.ids || body?.id || '';
    return ok(await this.crud.del('kuyou_goods_sales_exchange', String(ids)));
  }

  /** 零售退货单审核 / 反审核（源 examine?examine=1|2&ids=） */
  @Get('retail/goods_sales_exchange/examine')
  async exchangeExamineGet(@Query() q: any, @CurrentUser() user: any) {
    const state: 0 | 1 = Number(q.examine) === 2 ? 0 : 1;
    return ok(await this.doc.audit('kuyou_retail_sales_exchange', String(q.ids || ''), state, user));
  }

  @Post('retail/goods_sales_exchange/examine')
  async exchangeExaminePost(@Body() body: any, @CurrentUser() user: any) {
    const state: 0 | 1 = Number(body?.examine) === 2 || Number(body?.state) === 0 ? 0 : 1;
    return ok(await this.doc.audit('kuyou_retail_sales_exchange', String(body?.ids || body?.id || ''), state, user));
  }
}

