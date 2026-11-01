import { Module } from '@nestjs/common';
import { SpecialService } from './special.service';
import { SpecialController } from './special.controller';

/**
 * 专项业务模块
 * 承接通用 CRUD / 单据引擎覆盖不到的计算型页面：
 * MRP 计算、智能补货、已销订购看板、计件计时工资、结账反结账、系统初始化。
 */
@Module({
  controllers: [SpecialController],
  providers: [SpecialService],
  // 导出供其他模块注入：MiscController 依赖 SpecialService（如地区/利润等零散业务），
  // 未导出时 Nest 解析依赖失败，整个应用无法启动。
  exports: [SpecialService],
})
export class SpecialModule {}
