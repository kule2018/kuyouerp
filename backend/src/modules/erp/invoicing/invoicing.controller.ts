import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { InvoicingService, InvoiceKind } from './invoicing.service';
import { ok } from '../../../common/utils/resp';
import { BadRequestException } from '@nestjs/common';

/**
 * 开票登记控制器
 *
 * 覆盖原 kuyou 两个独立控制器：
 *  - Invoicing.php     采购开票
 *  - SalesInvoicing.php 销货开票
 *
 * 路由：/kuyou/invoicing/:kind/*，:kind ∈ { purchase, sales }
 *  - GET  :kind/list      已登记列表
 *  - GET  :kind/pending   待开票列表
 *  - GET  :kind/log       开票台账
 *  - POST :kind/register  开票登记
 *  - POST :kind/del       删除台账（回冲）
 */
@Controller('invoicing')
@UseGuards(JwtAuthGuard)
export class InvoicingController {
  constructor(private readonly svc: InvoicingService) {}

  /** 校验 kind 合法性 */
  private kindOf(kind: string): InvoiceKind {
    if (kind !== 'purchase' && kind !== 'sales') {
      throw new BadRequestException('kind 仅支持 purchase / sales');
    }
    return kind;
  }

  @Get(':kind/list')
  async list(@Param('kind') kind: string, @Query() q: any) {
    return ok(await this.svc.list(this.kindOf(kind), q));
  }

  @Get(':kind/pending')
  async pending(@Param('kind') kind: string) {
    return ok(await this.svc.pending(this.kindOf(kind)));
  }

  @Get(':kind/log')
  async logList(@Param('kind') kind: string, @Query() q: any) {
    return ok(await this.svc.logList(this.kindOf(kind), q));
  }

  @Post(':kind/register')
  async register(@Param('kind') kind: string, @Body() body: any, @CurrentUser() user: any) {
    return ok(await this.svc.register(this.kindOf(kind), body, user), '开票登记成功');
  }

  @Post(':kind/del')
  async del(@Param('kind') kind: string, @Body() body: any) {
    const ids = Array.isArray(body?.ids) ? body.ids : String(body?.ids || '').split(',').map((v: string) => parseInt(v, 10));
    return ok(await this.svc.removeLog(this.kindOf(kind), ids), '删除成功');
  }
}
