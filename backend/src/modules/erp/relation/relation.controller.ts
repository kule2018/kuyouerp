import { Controller, Get, Query } from '@nestjs/common';
import { RelationService } from './relation.service';

/**
 * 关联字典下拉选项接口（基础资料表单的外键选择器数据源）
 */
@Controller('relation')
export class RelationController {
  constructor(private readonly service: RelationService) {}

  @Get('options')
  async options(@Query() q: { table: string; value: string; label: string }) {
    return this.service.options(q.table, q.value, q.label);
  }
}
