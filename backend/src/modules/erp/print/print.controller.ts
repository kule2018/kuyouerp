import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { PrintService } from './print.service';
import { printTypeList } from './print.config';

/**
 * 打印控制器（1:1 对齐 FastAdmin 路由 kuyou/prints/prints）
 *
 * 接口：
 *  GET kuyou/prints/types  —— 返回全部打印类型（单据 / 汇总）
 *  GET kuyou/prints/print  —— 按 type + ids(单据) 或 search(汇总) 返回打印数据
 */
@Controller()
export class PrintController {
  constructor(private readonly printService: PrintService) {}

  /** 打印类型清单 */
  @Get('prints/types')
  types() {
    return printTypeList();
  }

  /**
   * 取打印数据
   * @param type   打印类型（见 PRINT_TYPES）
   * @param ids    单据 id 列表，逗号分隔（document 模式必填）
   * @param search 汇总检索条件，JSON 字符串（summary 模式可选）
   */
  @Get('prints/print')
  async print(
    @Query('type') type: string,
    @Query('ids') ids?: string,
    @Query('search') search?: string,
  ) {
    if (!type) throw new BadRequestException('缺少 type 参数');
    let idArr: string[] = [];
    if (ids) {
      idArr = ids
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    let searchObj: Record<string, any> = {};
    if (search) {
      try {
        searchObj = JSON.parse(search);
      } catch {
        throw new BadRequestException('search 参数格式错误');
      }
    }
    return this.printService.print(type, idArr, searchObj);
  }
}

