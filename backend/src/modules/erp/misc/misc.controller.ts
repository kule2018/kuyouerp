import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { MiscService } from './misc.service';
import { SpecialService } from '../special/special.service';
import { PrintService } from '../print/print.service';
import { StatsService } from '../stats/stats.service';
import { DOCUMENT_CONFIGS } from '../document/document.config';
import { DynamicCrudService } from '../dynamic-crud/dynamic-crud.service';
import { ok, table } from '../../../common/utils/resp';

/**
 * 零散业务控制器
 *
 * 路由与源 kuyou 前端调用路径逐一对应，其中：
 *  - checkout/checkout | checkoutf   结账 / 反结账（源命名，复用专项实现）
 *  - mrps/setdata | purchaseby/setdata | replenishment/setdata  MRP 与补货（源命名）
 *  - user_order/deliver              用户订单发货
 *  - address/area                    地区树
 *  - goods_sales_profit/index2       销售利润
 *  - cost/checkdata                  费用单明细预检
 *  - img/voucherAttachment | more    附件上传
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class MiscController {
  constructor(
    private readonly svc: MiscService,
    private readonly special: SpecialService,
    private readonly print: PrintService,
    private readonly stats: StatsService,
    private readonly crud: DynamicCrudService,
  ) {}

  /* ---------------- 结账 / 反结账（源命名别名） ---------------- */

  /** 结账（源 checkout/checkout） */
  @Post('checkout/checkout')
  async checkout(@Body() body: any, @CurrentUser() user: any) {
    return ok(await this.special.checkout(body, user));
  }

  /** 反结账（源 checkout/checkoutf） */
  @Post('checkout/checkoutf')
  async checkoutf() {
    return ok(await this.special.uncheckout());
  }

  /** 结账状态 */
  @Get('checkout/status')
  async checkoutStatus() {
    return ok(await this.special.checkoutStatus());
  }

  /* ---------------- MRP / 补货（源命名别名） ---------------- */

  /** MRP 计算（源 mrps/setdata） */
  @Post('mrps/setdata')
  async mrpSetdata(@Body() body: any, @CurrentUser() user: any) {
    return ok(await this.special.mrpCompute(body, user));
  }

  /** MRP 结果列表 */
  @Get('mrps/list')
  async mrpList(@Query() q: any) {
    return ok(await this.special.mrpList(q));
  }

  /** 已销订购看板（源 purchaseby/setdata） */
  @Get('purchaseby/setdata')
  async soldOrdered(@Query() q: any) {
    return ok(await this.special.soldOrdered(q));
  }

  /** 智能补货（源 replenishment/setdata） */
  @Get('replenishment/setdata')
  async replenishment(@Query() q: any) {
    return ok(await this.special.replenishment(q));
  }

  /* ---------------- 用户订单发货 ---------------- */

  /** 发货（源 user_order/deliver?ids=&type=1） */
  @Post('user_order/deliver')
  async deliver(@Query() q: any, @Body() body: any) {
    const ids = body?.ids ?? q?.ids;
    return ok(await this.svc.deliver(String(ids), body?.row || body), '发货成功');
  }

  /** 用户订单审核（源 user_order/examine?ids=，status 0→2） */
  @Post('user_order/examine')
  async userOrderExamine(@Query() q: any, @Body() body: any) {
    const ids = body?.ids ?? q?.ids;
    return ok(await this.svc.userOrderExamine(String(ids)), '审核成功');
  }

  /** 盘点库存导出（源 inventory/export，返回 xlsx 文件流） */
  @Get('inventory/export')
  async inventoryExport(@Res() res: any) {
    const buf = await this.svc.inventoryExport();
    const title = `盘点${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment;filename="${encodeURIComponent(title)}.xlsx"`);
    res.setHeader('Cache-Control', 'max-age=0');
    res.end(buf);
  }

  /* ---------------- 地区 ---------------- */

  /** 地区树（源 address/area） */
  @Get('address/area')
  async area(@Query() q: any) {
    const r = await this.svc.area(q.pid ?? 0);
    return table(r.total, r.rows);
  }

  /* ---------------- 报表 ---------------- */

  /** 销售利润（源 goods_sales_profit/index2） */
  @Get('goods_sales_profit/index2')
  async salesProfit(@Query() q: any) {
    const r = await this.svc.salesProfit(q);
    return table(r.total, r.rows);
  }

  /* ---------------- 费用单 ---------------- */

  /** 费用单明细预检（源 cost/checkdata） */
  @Post('cost/checkdata')
  async costCheckdata(@Body() body: any) {
    return ok(await this.svc.costCheckdata(body || {}));
  }

  /* ---------------- 打印 / 数据中心 / 零售（源命名别名） ---------------- */

  /** 打印（源 prints/prints） */
  @Get('prints/prints')
  async prints(@Query() q: any) {
    const ids = String(q.ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    return ok(await this.print.print(String(q.type || ''), ids, q));
  }

  /** 数据中心明细（源 datainfo/datainfo） */
  @Get('datainfo/datainfo')
  async datainfo(@Query() q: any) {
    return ok(await this.stats.datainfo(Number(q.types) || 1));
  }

  /** 数据中心汇总（源 datainfo/datainfos、datainfo/stockworing） */
  @Get('datainfo/datainfos')
  async datainfos() {
    return ok(await this.stats.datainfoSummary());
  }

  @Get('datainfo/stockworing')
  async stockworing() {
    return ok(await this.stats.datainfoSummary());
  }

  /** 零售单（源 retail/goods_sales）走单据引擎的零售配置（order_type=2 固定过滤） */
  @Get('retail/goods_sales')
  async retailSales(@Query() q: any) {
    return table(await this.docList('kuyou_retail_sales', q));
  }

  /** 零售退货单（源 retail/goods_sales_exchange） */
  @Get('retail/goods_sales_exchange')
  async retailSalesExchange(@Query() q: any) {
    return table(await this.docList('kuyou_retail_sales_exchange', q));
  }

  /** 按单据 key 取列表：虚拟 key → 物理表 + 业务固定过滤 */
  private async docList(docType: string, q: any) {
    const c = DOCUMENT_CONFIGS[docType];
    if (!c) throw new BadRequestException(`单据未注册: ${docType}`);
    return this.crud.list(c.header, { ...q, extraFilter: c.fixedFilter });
  }

  /**
   * 菜单 / 权限节点查询（源 Goods::getMenu、Warehousing::getMenu、common/menu）
   * 按 URL 名称取权限节点；库内无 auth_rule 表时降级返回空节点，避免前端取菜单报错。
   */
  @Get('common/menu')
  async commonMenu(@Query() q: any) {
    const url = String(q.url || q.name || '');
    try {
      const rows = await this.svc.query('SELECT * FROM `auth_rule` WHERE `name` = ?', [url]);
      return ok(rows[0] || null);
    } catch (e) {
      return ok(null);
    }
  }

  /** 权限节点查询（源 Goods::getMenu、Warehousing::getMenu，按 URL 名称取节点） */
  @Get('goods/getMenu')
  async goodsGetMenu(@Query() q: any) {
    return this.commonMenu(q);
  }

  @Get('Warehousing/getMenu')
  async warehousingGetMenu(@Query() q: any) {
    return this.commonMenu(q);
  }

  /** 费用单提交（源 cost/assemble，前端仅做提交回执） */
  @Post('cost/assemble')
  async costAssemble(@Body() body: any) {
    return ok({ received: true }, '操作成功');
  }

  /* ---------------- 附件上传 ---------------- */

  /** 凭证附件上传（源 img/voucherAttachment） */
  @Post('img/voucherAttachment')
  @UseInterceptors(FileInterceptor('file'))
  async voucherAttachment(@UploadedFile() file: any) {
    const r = await this.svc.saveUpload(file);
    return ok(r);
  }

  /** 多图上传（源 img/more） */
  @Post('img/more')
  @UseInterceptors(FileInterceptor('file'))
  async imgMore(@UploadedFile() file: any) {
    const r = await this.svc.saveUpload(file);
    return ok(r);
  }
}

