import { Module } from '@nestjs/common';
import { RelationService } from './relation.service';
import { RelationController } from './relation.controller';

/**
 * 关联字典模块：为前端下拉框提供字典表 value/label 选项
 */
@Module({
  controllers: [RelationController],
  providers: [RelationService],
  exports: [RelationService],
})
export class RelationModule {}
