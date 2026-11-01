import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { SpecialService } from './special.service';
import { ok } from '../../../common/utils/resp';

/**
 * 专项业务控制器
 *
 * 覆盖原 kuyou 中「带计算逻辑」的六类页面，这些无法由通用 CRUD / 单据引擎表达：
 *  - MRP 计算        /kuyou/special/mrp/*
 *  - 智能补货        /kuyou/special/replenishment
 *  - 已销订购看板    /kuyou/special/sold-ordered
 *  - 计件/计时工资   /kuyou/special/wages
 *  - 结账 / 反结账   /kuyou/special/checkout/*
 *  - 系统初始化      /kuyou/special/initialization
 *
 * 路由统一走 3 段路径，与动态 CRUD 的 /kuyou/:table/:action 不冲突。
 */
@Controller('special')
@UseGuards(JwtAuthGuard)
export class SpecialController {
  constructor(private readonly svc: SpecialService) {}

  /* ---------------- MRP ---------------- */

  /** 生产计划的可选明细行（勾选后参与计算） */
  @Get('mrp/plan-lines')
  async planLines(@Query('purchase_code') purchaseCode: string) {
    return ok(await this.svc.planLines(purchaseCode));
  }

  /** MRP 结果列表 */
  @Get('mrp/list')
  async mrpList(@Query() q: any) {
    return ok(await this.svc.mrpList(q));
  }

  /** MRP 结果明细 */
  @Get('mrp/detail/:id')
  async mrpDetail(@Param('id') id: string) {
    return ok(await this.svc.mrpDetail(Number(id)));
  }

  /**
   * 执行 MRP 计算
   * @param body.purchase_code 生产计划单号
   * @param body.info_id       勾选的明细行 id
   */
  @Post('mrp/compute')
  async mrpCompute(@Body() body: any, @CurrentUser() user: any) {
    return ok(await this.svc.mrpCompute(body, user), 'MRP 计算完成');
  }

  /* ---------------- 智能补货 ---------------- */

  /** 建议采购量清单（支持 start_time / end_time 口径） */
  @Get('replenishment')
  async replenishment(@Query() q: any) {
    return ok(await this.svc.replenishment(q));
  }

  /* ---------------- 已销订购看板 ---------------- */

  /** 销售订单的发货 / 订购状态跟踪 */
  @Get('sold-ordered')
  async soldOrdered(@Query() q: any) {
    return ok(await this.svc.soldOrdered(q));
  }

  /* ---------------- 工资 ---------------- */

  /** 计件(type=piece) / 计时(type=hour) 工资 */
  @Get('wages')
  async wages(@Query() q: any) {
    return ok(await this.svc.wages(q));
  }

  /* ---------------- 结账 ---------------- */

  /** 当前结账状态（启用日期 / 上次结账日期） */
  @Get('checkout/status')
  async checkoutStatus() {
    return ok(await this.svc.checkoutStatus());
  }

  /** 期末结账 */
  @Post('checkout/do')
  async checkout(@Body() body: any, @CurrentUser() user: any) {
    return ok(await this.svc.checkout(body, user), '结账成功');
  }

  /** 反结账（回滚最后一次结账） */
  @Post('checkout/undo')
  async uncheckout() {
    return ok(await this.svc.uncheckout(), '反结账成功');
  }

  /* ---------------- 系统初始化 ---------------- */

  /**
   * 系统初始化（不可逆）
   * @param body.confirm 必须为 'INITIALIZE'
   */
  @Post('initialization')
  async initialization(@Body() body: any) {
    return ok(await this.svc.initialization(body), '系统初始化完成');
  }
}
