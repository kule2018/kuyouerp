import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ok, table } from '../../../common/utils/resp';
import { DataService } from './data.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class DataController {
  constructor(private readonly svc: DataService) {}

  @Get('operate_log/index')
  operateLog(@Query('limit') limit: string) {
    return ok(this.svc.operateLog(Number(limit) || 200));
  }

  @Get('data/export')
  export(@Query('table') table: string, @Query('limit') limit: string) {
    return ok(this.svc.export(table, Number(limit) || 500));
  }
}

