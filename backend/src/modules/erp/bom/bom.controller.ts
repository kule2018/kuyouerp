import { Controller, Get, Post, Body, Param, Query, HttpCode } from '@nestjs/common';
import { BomService } from './bom.service';

/**
 * BOM（配方）/ 工序 接口
 * 路由前缀 kuyou/bom，与单据 / 报表 / 专项等模块互不冲突。
 */
@Controller('bom')
export class BomController {
  constructor(private readonly service: BomService) {}

  /* ---------------- BOM 清单 ---------------- */
  @Get('listBom')
  async listBom(@Query() q: { page?: string; limit?: string; search?: string }) {
    return this.service.listBom({
      page: q.page ? Number(q.page) : 1,
      limit: q.limit ? Number(q.limit) : 15,
      search: q.search,
    });
  }

  @Get('getBom/:id')
  async getBom(@Param('id') id: string) {
    return this.service.getBom(id);
  }

  @Post('saveBom')
  @HttpCode(200)
  async saveBom(@Body() body: { header?: Record<string, any>; materials?: any[] }) {
    return this.service.saveBom(body);
  }

  @Post('delBom')
  @HttpCode(200)
  async delBom(@Body() body: { id: number | string }) {
    return this.service.delBom(body.id);
  }

  /* ---------------- 工序 ---------------- */
  @Get('listProcedure')
  async listProcedure(@Query() q: { bomId?: string; search?: string }) {
    return this.service.listProcedure({ bomId: q.bomId ? Number(q.bomId) : undefined, search: q.search });
  }

  @Get('getProcedure/:id')
  async getProcedure(@Param('id') id: string) {
    return this.service.getProcedure(id);
  }

  @Post('saveProcedure')
  @HttpCode(200)
  async saveProcedure(@Body() body: { header?: Record<string, any>; materials?: any[] }) {
    return this.service.saveProcedure(body);
  }

  @Post('delProcedure')
  @HttpCode(200)
  async delProcedure(@Body() body: { id: number | string }) {
    return this.service.delProcedure(body.id);
  }
}
