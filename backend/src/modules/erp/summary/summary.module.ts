import { Module } from '@nestjs/common';
import { SummaryService } from './summary.service';
import { SummaryController } from './summary.controller';

/**
 * 汇总报表模块
 * 覆盖源端：采购汇总（按供应商）/ 销货汇总（按业务员）/ 销货汇总（按客户）/ 收入支出报表。
 */
@Module({
  controllers: [SummaryController],
  providers: [SummaryService],
  exports: [SummaryService],
})
export class SummaryModule {}
