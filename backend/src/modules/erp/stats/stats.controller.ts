import { Controller, Get, Query } from '@nestjs/common';
import { StatsService } from './stats.service';

/**
 * 统计 / 数据中心控制器（1:1 对齐 kuyou Intercourse.php、Datainfo.php）
 *
 * 接口：
 *  GET kuyou/intercourse/index  —— 往来单位欠款表（客户应收 / 供应商应付）
 *  GET kuyou/datainfo/index     —— 数据中心看板（趋势 / 库存 / 账户）
 *  GET kuyou/datainfo/summary   —— 本月购销汇总卡片
 */
@Controller()
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  /** 往来单位欠款表 */
  @Get('intercourse/index')
  async intercourse(
    @Query('types') types?: string,
    @Query('keyword') keyword?: string,
  ) {
    let typeArr: number[] = [];
    if (types) {
      typeArr = types
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => !Number.isNaN(n));
    }
    return this.statsService.intercourse(typeArr, keyword || '');
  }

  /** 数据中心看板 */
  @Get('datainfo/index')
  async datainfo(@Query('types') types?: string) {
    const t = Number(types) || 1;
    return this.statsService.datainfo(t);
  }

  /** 本月购销汇总 */
  @Get('datainfo/summary')
  async summary() {
    return this.statsService.datainfoSummary();
  }

  /** 生产成本统计（kuyou Acceptances.php） */
  @Get('acceptances/cost')
  async productionCost(@Query() q: any) {
    return this.statsService.productionCost(q);
  }

  /** 生产数据面板汇总 */
  @Get('production/summary')
  async productionSummary() {
    return this.statsService.productionSummary();
  }
}

