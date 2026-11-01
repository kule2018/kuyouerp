import { Module } from '@nestjs/common';
import { RetailService } from './retail.service';
import { RetailController } from './retail.controller';
import { DocumentModule } from '../document/document.module';
import { DynamicCrudModule } from '../dynamic-crud/dynamic-crud.module';

/**
 * 零售收银台模块
 * POS 商品网格、结算过账（双单号 + 库存/批次/序列号分配 + 自动审核）与零售单审核、
 * 零售单 / 零售退货单的列表 / 编辑 / 删除 / 审核（复用文档引擎与动态 CRUD）。
 */
@Module({
  imports: [DocumentModule, DynamicCrudModule],
  controllers: [RetailController],
  providers: [RetailService],
  exports: [RetailService],
})
export class RetailModule {}
