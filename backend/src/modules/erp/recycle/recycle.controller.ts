import { Controller, Get, Post, Query, Body, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RecycleService } from './recycle.service';
import { TemplateService } from './template.service';
import { table, ok } from '../../../common/utils/resp';

/**
 * 回收站 + 单据模板控制器
 *
 * 路由与源 kuyou 前端调用路径逐一对应：
 *   kuyou/suppliers/recyclebin | restore | destroy
 *   kuyou/goods_purchase/recyclebin
 *   kuyou/suppliers_user/recyclebin | restore | destroy
 *   kuyou/assemble/savetemp  kuyou/assemble_temp/gettemp
 *   kuyou/split/savetemp     kuyou/split_temp/gettemp
 * 另外提供 kuyou/:table/recyclebin 等通用路由覆盖其余软删表。
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class RecycleController {
  constructor(
    private readonly svc: RecycleService,
    private readonly tpl: TemplateService,
  ) {}

  /* ---------------- 通用回收站（所有软删表，白名单见 RecycleService.RECYCLE_TABLES） ---------------- */

  @Get(':table/recyclebin')
  async bin(@Param('table') t: string, @Query() q: any) {
    return table(await this.svc.list(t, q.page, q.limit, q.sort, q.order));
  }

  @Post(':table/restore')
  async restore(@Param('table') t: string, @Body() body: any) {
    return ok(await this.svc.restore(t, body.ids));
  }

  @Post(':table/destroy')
  async destroy(@Param('table') t: string, @Body() body: any) {
    return ok(await this.svc.destroy(t, body.ids));
  }

  /* ---------------- 单据模板 ---------------- */

  /** 组装单另存为模板 */
  @Post('assemble/savetemp')
  async assembleSavetemp(@Body() body: any, @Req() req: any) {
    const id = await this.tpl.savetemp('assemble', body.temp_name, body.row || body, req.user?.id ?? 0);
    return ok(id);
  }

  /** 拆卸单另存为模板 */
  @Post('split/savetemp')
  async splitSavetemp(@Body() body: any, @Req() req: any) {
    const id = await this.tpl.savetemp('split', body.temp_name, body.row || body, req.user?.id ?? 0);
    return ok(id);
  }

  /** 取用组装单模板（明细联商品带 goods_name） */
  @Post('assemble_temp/gettemp')
  async assembleGettemp(@Body() body: any) {
    return ok(await this.tpl.gettemp('assemble', body.id));
  }

  /** 取用拆卸单模板 */
  @Post('split_temp/gettemp')
  async splitGettemp(@Body() body: any) {
    return ok(await this.tpl.gettemp('split', body.id));
  }
}

