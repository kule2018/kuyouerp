import { Module } from '@nestjs/common';
import { RecycleService } from './recycle.service';
import { TemplateService } from './template.service';
import { RecycleController } from './recycle.controller';

/** 回收站（recyclebin/restore/destroy）与单据模板（savetemp/gettemp）模块 */
@Module({
  controllers: [RecycleController],
  providers: [RecycleService, TemplateService],
  exports: [RecycleService, TemplateService],
})
export class RecycleModule {}
