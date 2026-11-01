import { Controller, Get, Post, Query, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CustomerGoodscodingService } from './customer-goodscoding.service';
import { ok, table } from '../../../common/utils/resp';

/**
 * 客户价目表接口
 *  - GET  /kuyou/customer-goodscoding/list        列表（join 商品/客户/单位）
 *  - GET  /kuyou/customer-goodscoding/detail/:id   详情
 *  - POST /kuyou/customer-goodscoding/add          批量新增（customers_id + code_data[]）
 *  - POST /kuyou/customer-goodscoding/edit         单行编辑
 *  - POST /kuyou/customer-goodscoding/del          删除（id 或 id 数组）
 */
@Controller('customer-goodscoding')
@UseGuards(JwtAuthGuard)
export class CustomerGoodscodingController {
  constructor(private readonly svc: CustomerGoodscodingService) {}

  @Get('list')
  async list(@Query() q: any) {
    const r = await this.svc.list(q);
    return table(r.count, r.list);
  }

  @Get('detail/:id')
  async detail(@Param('id') id: string) {
    return ok(await this.svc.detail(Number(id)));
  }

  @Post('add')
  async add(@Body() body: any) {
    return ok(await this.svc.add(body), '添加成功');
  }

  @Post('edit')
  async edit(@Body() body: any) {
    return ok(await this.svc.edit(body), '更新成功');
  }

  @Post('del')
  async del(@Body() body: any) {
    return ok(await this.svc.del(body.id));
  }
}
