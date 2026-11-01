import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ReportService } from './report.service';
import { ok, table as tableResp } from '../../../common/utils/resp';

/**
 * 报表控制器
 *  - GET  /kuyou/reports      报表清单（含列定义与筛选器，驱动前端菜单与表单）
 *  - GET  /kuyou/report/:key  执行报表（支持 offset/limit 分页）
 *  - POST /kuyou/report/:key  同上（筛选条件较多时用 body 传参）
 * 与原 kuyou 的 report 类页面一一对应，返回 {total, rows} 兼容 layui 表格约定。
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly svc: ReportService) {}

  @Get('reports')
  listReports() {
    return ok(this.svc.list());
  }

  @Get('report/:key')
  async runGet(
    @Param('key') key: string,
    @Query('offset') offset = 0,
    @Query('limit') limit = 50,
    @Query() q: Record<string, any>,
  ) {
    const r = await this.svc.run(key, q, Number(offset), Number(limit));
    return tableResp(r.total, r.rows, { columns: r.columns, totals: r.totals });
  }

  @Post('report/:key')
  async runPost(
    @Param('key') key: string,
    @Query('offset') offset = 0,
    @Query('limit') limit = 50,
    @Body() body: Record<string, any>,
  ) {
    const r = await this.svc.run(key, body, Number(offset), Number(limit));
    return tableResp(r.total, r.rows, { columns: r.columns, totals: r.totals });
  }
}

