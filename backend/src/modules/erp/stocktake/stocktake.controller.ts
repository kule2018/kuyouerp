import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ok, table } from '../../../common/utils/resp';
import { StocktakeService } from './stocktake.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class StocktakeController {
  constructor(private readonly svc: StocktakeService) {}

  @Post('stocktake/add')
  add(@Body() body: any, @CurrentUser() user: any) {
    return ok(this.svc.add({ ...body, admin_id: user?.id ?? body.admin_id }));
  }

  @Post('stocktake/post')
  post(@Body() body: any, @CurrentUser() user: any) {
    return ok(this.svc.post(Number(body.id), user?.id ?? body.admin_id));
  }

  /** 盘点单列表 */
  @Get('stocktake/index')
  async index(@Query() q: any) {
    const rows: any[] = await this.svc.list(Number(q.limit) || 100);
    return table(rows.length, rows);
  }

  /** 盘点单明细 */
  @Get('stocktake/detail/:id')
  async detail(@Param('id') id: string) {
    const rows: any[] = await this.svc.detail(Number(id));
    return ok(rows);
  }
}

