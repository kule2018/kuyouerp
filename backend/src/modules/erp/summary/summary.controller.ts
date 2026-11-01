import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { table } from '../../../common/utils/resp';
import { SummaryService, SummaryKind } from './summary.service';

/**
 * 汇总报表
 * 路由与源端一一对应：
 *   GET kuyou/goods_purchase_summarys/index  采购汇总（按供应商）
 *   GET kuyou/goods_sales_summarys/index     销货汇总（按业务员）
 *   GET kuyou/goods_sales_summaryc/index     销货汇总（按客户）
 *   GET kuyou/revenue/index                  收入支出报表
 */
@UseGuards(JwtAuthGuard)
@Controller()
export class SummaryController {
  constructor(private readonly svc: SummaryService) {}

  /** 采购汇总：按供应商维度，固定只看 purchase_type=1 普通采购 */
  @Get('goods_purchase_summarys/index')
  async purchaseSummarys(@Query() q: any) {
    const r = await this.svc.run('purchase_supplier' as SummaryKind, q.filter, q.field, q.order);
    return table(r.total, r.rows);
  }

  /** 销货汇总：按业务员（职员）维度 */
  @Get('goods_sales_summarys/index')
  async salesSummarys(@Query() q: any) {
    const r = await this.svc.run('sale_user' as SummaryKind, q.filter, q.field, q.order);
    return table(r.total, r.rows);
  }

  /** 销货汇总：按客户维度 */
  @Get('goods_sales_summaryc/index')
  async salesSummaryc(@Query() q: any) {
    const r = await this.svc.run('sale_customer' as SummaryKind, q.filter, q.field, q.order);
    return table(r.total, r.rows);
  }

  /**
   * 收入支出报表
   * @param q.filter JSON 过滤条件（purchase_time / business_type）
   */
  @Get('revenue/index')
  async revenue(@Query() q: any) {
    const r = await this.svc.revenue(q.filter);
    return table(r.total, r.rows);
  }

  /**
   * 经营利润汇总（源 profit/index，POST 提交日期区间）
   * @param body.purchase_time 日期区间（' - ' 分隔），空则取本月 1 日至今
   */
  @Post('profit/index')
  async profit(@Body() body: any) {
    const r = await this.svc.profit(body?.start_time, body?.end_time);
    return r;
  }
}

