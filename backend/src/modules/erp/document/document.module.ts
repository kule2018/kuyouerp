import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { DynamicCrudModule } from '../dynamic-crud/dynamic-crud.module';

/**
 * 通用单据模块
 * 覆盖购货/销货/退货/收款/付款/转账等主从单据的保存与审核过账，
 * 与 DynamicCrudModule 的列表/删除接口共存（save/audit/doc/doclist 为新增路由，不冲突）。
 */
@Module({
  imports: [DynamicCrudModule],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
