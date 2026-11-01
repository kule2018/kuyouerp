import { Controller, Get, Post, Param, Body, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { DocumentService, SaveDocBody } from './document.service';
import { DOCUMENT_CONFIGS } from './document.config';
import { ok, table } from '../../../common/utils/resp';
import { TABLE_META } from '../../../table-meta';
import { DynamicCrudService } from '../dynamic-crud/dynamic-crud.service';

/**
 * 通用单据控制器（路由与原 kuyou 的 kuyou/模块/方法 约定对齐）
 *  - GET  /kuyou/:table/doclist     单据列表（含业务固定过滤，如零售单 order_type=2）
 *  - GET  /kuyou/:table/doc/:id     主表 + 明细行（编辑回显）
 *  - POST /kuyou/:table/save        主从整体保存（事务）
 *  - POST /kuyou/:table/audit       审核 / 反审核（事务，仓库单据联动库存）
 *  - GET  /kuyou/documents          已注册的单据清单（供前端菜单/页面判断）
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(
    private readonly svc: DocumentService,
    private readonly crud: DynamicCrudService,
  ) {}

  @Get('documents')
  listDocs() {
    return ok(
      Object.entries(DOCUMENT_CONFIGS)
        .filter(([, c]) => !!TABLE_META[c.header])
        .map(([key, c]) => ({
          key,
          title: c.title,
          group: c.group,
          codeField: c.codeField,
          statusField: c.statusField,
          hasDetail: !!c.detail,
          hasStock: !!c.stock || !!c.transfer,
          auditable: !!c.statusField,
        })),
    );
  }

  /**
   * 单据列表
   * 与通用 CRUD 的区别：虚拟单据 key（如 kuyou_retail_sales）指向真实物理表，
   * 并强制叠加配置的 fixedFilter，实现「同一张表多个业务页面」。
   */
  @Get(':table/doclist')
  async docList(@Param('table') docType: string, @Query() q: any) {
    const c = DOCUMENT_CONFIGS[docType];
    if (!c) throw new BadRequestException(`单据未注册: ${docType}`);
    const r = await this.crud.list(c.header, { ...q, extraFilter: c.fixedFilter });
    return table(r.total, r.rows);
  }

  @Get(':table/doc/:id')
  async detail(@Param('table') table: string, @Param('id') id: string) {
    return ok(await this.svc.docDetail(table, id));
  }

  /**
   * 订货单转销货单预取（源 goods_sales/add?order_id=）
   * 按用户订单带出客户 / 收货地址 / 商品明细，保存时回写订货单关联。
   * @param q.order_id 用户订单主键
   */
  @Get(':table/prefill')
  async prefill(@Query() q: any) {
    return ok(await this.svc.prefillFromOrder(q.order_id));
  }

  @Post(':table/save')
  async save(
    @Param('table') table: string,
    @Body() body: SaveDocBody,
    @CurrentUser() user: any,
  ) {
    return ok(await this.svc.saveDoc(table, body, user), '保存成功');
  }

  /**
   * 审核 / 反审核
   * @param body.id    单据主键
   * @param body.state 1=审核（联动库存与资金）0=反审核（整体冲回）
   */
  @Post(':table/audit')
  async audit(@Param('table') table: string, @Body() body: any, @CurrentUser() user: any) {
    const state = Number(body?.state) === 0 ? 0 : 1;
    const r = await this.svc.audit(table, body?.id, state as 0 | 1, user);
    return ok(r, state === 1 ? '审核成功' : '反审核成功');
  }

  /**
   * 对单 / 反对单（对应源 counter）
   * 只切换核对位 check_status，不过账不动库存。
   * @param body.state 1=对单 0=反对单
   */
  @Post(':table/counter')
  async counter(@Param('table') table: string, @Body() body: any, @CurrentUser() user: any) {
    const state = Number(body?.state) === 0 ? 0 : 1;
    const r = await this.svc.counter(table, body?.id, state as 0 | 1, user);
    return ok(r, state === 1 ? '对单成功' : '反对单成功');
  }

  /**
   * 审核 / 反审核（源端命名 examine，与 audit 等价）
   * 源前端以 GET kuyou/<单据>/examine?examine=1&ids=xx 调用：
   * examine=1 审核，examine=2 反审核，ids 支持逗号分隔批量。
   * 这里同时兼容 POST，params 形如 { status: 1 }。
   */
  @Get(':table/examine')
  async examineGet(@Param('table') table: string, @Query() q: any, @CurrentUser() user: any) {
    return this.doExamine(table, q.examine, q.ids, q, user);
  }

  @Post(':table/examine')
  async examinePost(@Param('table') table: string, @Body() body: any, @CurrentUser() user: any) {
    return this.doExamine(table, body.examine ?? body.state, body.ids ?? body.id, body, user);
  }

  /** 审核执行：state=1 审核，其余按反审核处理（源 examine=2 为反审核） */
  private async doExamine(table: string, examine: any, ids: any, payload: any, user: any) {
    const state = Number(examine) === 1 ? 1 : 0;
    const list = String(ids ?? payload?.id ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    const results: any[] = [];
    for (const id of list) {
      results.push(await this.svc.audit(table, id, state as 0 | 1, user));
    }
    return ok(results.length === 1 ? results[0] : results, state === 1 ? '审核成功' : '反审核成功');
  }
}

