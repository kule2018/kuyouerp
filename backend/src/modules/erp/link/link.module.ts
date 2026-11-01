import { Module } from '@nestjs/common';
import { LinkService } from './link.service';
import { LinkController } from './link.controller';

/** 表单联动模块：商品单位价格、序列号、批次、效期、源单检查、生产链联动 */
@Module({
  controllers: [LinkController],
  providers: [LinkService],
  exports: [LinkService],
})
export class LinkModule {}
