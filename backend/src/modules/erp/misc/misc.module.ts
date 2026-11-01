import { Module } from '@nestjs/common';
import { MiscService } from './misc.service';
import { MiscController } from './misc.controller';
import { SpecialModule } from '../special/special.module';
import { PrintModule } from '../print/print.module';
import { StatsModule } from '../stats/stats.module';
import { DocumentModule } from '../document/document.module';
import { DynamicCrudModule } from '../dynamic-crud/dynamic-crud.module';

/** 零散业务模块（发货 / 地区 / 利润 / 费用预检 / 附件上传 + 源命名别名路由） */
@Module({
  imports: [SpecialModule, PrintModule, StatsModule, DocumentModule, DynamicCrudModule],
  controllers: [MiscController],
  providers: [MiscService],
  exports: [MiscService],
})
export class MiscModule {}
