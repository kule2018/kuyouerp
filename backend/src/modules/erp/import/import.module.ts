import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { DocumentModule } from '../document/document.module';

/** 基础资料 Excel 导入模块（含上传端点） */
@Module({
  imports: [DocumentModule],
  controllers: [ImportController],
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportModule {}
