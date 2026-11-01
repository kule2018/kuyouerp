import { Module } from '@nestjs/common';
import { ReconService } from './recon.service';
import { ReconController } from './recon.controller';

/**
 * 对账与汇总模块
 * 覆盖源端 4 个复合页面：客户对账单、供应商对账单、商品收发明细汇总、序列号状态。
 */
@Module({
  controllers: [ReconController],
  providers: [ReconService],
  exports: [ReconService],
})
export class ReconModule {}
