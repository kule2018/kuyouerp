import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BomService } from './bom.service';
import { BomController } from './bom.controller';

/**
 * BOM（配方）/ 工序 模块
 * BOM 与工序共享 kuyou_bom_info 明细表，靠 procedure_id 区分。
 */
@Module({
  imports: [],
  controllers: [BomController],
  providers: [BomService],
  exports: [BomService],
})
export class BomModule {}
