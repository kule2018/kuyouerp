import { Module } from '@nestjs/common';
import { InvoicingController } from './invoicing.controller';
import { InvoicingService } from './invoicing.service';

/**
 * 开票登记模块（采购开票 / 销货开票）
 * 复用根 Connection（与动态 CRUD / 单据 / 报表 / 专项共用同一个 MySQL 连接）
 */
@Module({
  controllers: [InvoicingController],
  providers: [InvoicingService],
  exports: [InvoicingService],
})
export class InvoicingModule {}
