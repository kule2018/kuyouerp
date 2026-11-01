import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ok, table } from '../../../common/utils/resp';
import { ReconService } from './recon.service';

/**
 * 往来对账单 / 收发汇总 / 序列号状态
 * 路由与源端一一对应：
 *   GET kuyou/customers_recon/index      客户对账单
 *   GET kuyou/suppliers_recon/index      供应商对账单
 *   GET kuyou/goods_log_summary/index    商品收发明细汇总
 *   GET kuyou/goods_serial_status/index  序列号状态
 */
@UseGuards(JwtAuthGuard)
@Controller()
export class ReconController {
  constructor(private readonly svc: ReconService) {}

  /**
   * 客户对账单
   * @param q.filter JSON 过滤条件（purchase_time / customers_id / staff_member_id / id）
   * @param q.sort  排序字段，默认 createtime
   * @param q.order 排序方向，默认 ASC
   */
  @Get('customers_recon/index')
  async customersRecon(@Query() q: any) {
    const r = await this.svc.customers(q.filter, q.sort, q.order);
    return table(r.total, r.rows, {
      all_sale_money: r.all_sale_money,
      all_receivable: r.all_receivable,
      all_cost: r.all_cost,
      all_real_money: r.all_real_money,
      all_balance: r.all_balance,
    });
  }

  /**
   * 供应商对账单（与客户对账单镜像，往来方取供应商、流水取应付表）
   */
  @Get('suppliers_recon/index')
  async suppliersRecon(@Query() q: any) {
    const r = await this.svc.suppliers(q.filter, q.sort, q.order);
    return table(r.total, r.rows, {
      all_sale_money: r.all_sale_money,
      all_receivable: r.all_receivable,
      all_cost: r.all_cost,
      all_real_money: r.all_real_money,
      all_balance: r.all_balance,
    });
  }

  /**
   * 商品收发明细汇总（源 goods_log_summary/index）
   * 返回 { total, rows }，每行含期初 / 各类出入库 / 结存的数量与成本。
   */
  @Get('goods_log_summary/index')
  async goodsLogSummary(@Query() q: any) {
    const r = await this.svc.goodsLogSummary(q.filter);
    return table(r.total, r.rows);
  }

  /**
   * 序列号状态（源 goods_serial_status/index）
   * @param q.store_status 库存状态过滤（0/1/2…），空表示不过滤
   */
  @Get('goods_serial_status/index')
  async goodsSerialStatus(@Query() q: any) {
    const r = await this.svc.goodsSerialStatus(q.filter, q.store_status, Number(q.page) || 1, Number(q.limit) || 20);
    return table(r.total, r.rows);
  }

  /** 对账类型健康检查（便于前端在切换 tab 前确认后端可用） */
  @Get('recon/types')
  async types() {
    return ok([
      { key: 'customers_recon', title: '客户对账单' },
      { key: 'suppliers_recon', title: '供应商对账单' },
      { key: 'goods_log_summary', title: '商品收发明细汇总' },
      { key: 'goods_serial_status', title: '序列号状态' },
    ]);
  }
}

