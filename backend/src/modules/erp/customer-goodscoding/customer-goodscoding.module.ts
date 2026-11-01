import { Module } from '@nestjs/common';
import { CustomerGoodscodingService } from './customer-goodscoding.service';
import { CustomerGoodscodingController } from './customer-goodscoding.controller';

/** 客户价目表模块 */
@Module({
  providers: [CustomerGoodscodingService],
  controllers: [CustomerGoodscodingController],
  exports: [CustomerGoodscodingService],
})
export class CustomerGoodscodingModule {}
