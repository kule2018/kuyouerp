import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { DynamicCrudService, QueryParams } from './dynamic-crud.service';
import { ok, table as tableResp } from '../../../common/utils/resp';

/**
 * 动态 CRUD 控制器
 * 路由与原 kuyou FastAdmin 完全一致：/kuyou/<模块>/<方法>
 *  - GET  /kuyou/:table(kuyou_[A-Za-z0-9_]+)/index        列表 {total, rows}
 *  - GET  /kuyou/:table(kuyou_[A-Za-z0-9_]+)/selectpage   下拉/表格 {total, rows, list}
 *  - GET  /kuyou/:table(kuyou_[A-Za-z0-9_]+)/detail/:id   单条（编辑回显）
 *  - POST /kuyou/:table(kuyou_[A-Za-z0-9_]+)/add          新增
 *  - POST /kuyou/:table(kuyou_[A-Za-z0-9_]+)/edit         编辑
 *  - POST /kuyou/:table(kuyou_[A-Za-z0-9_]+)/del          删除（软删/物理删）
 *  - POST /kuyou/:table(kuyou_[A-Za-z0-9_]+)/multi        批量操作
 * 覆盖全部 156 张 kuyou_ 表，字段用数据库原始列名（snake_case）。
 *
 * 权限：JwtAuthGuard 鉴权后，PermissionsGuard 按约定校验
 *  （读=menu:<table>，写=button:<table>:<action>），超管持 * 通配。
 * 数据权限：将当前用户传入 service，按角色授权仓库过滤 store_id/stores_id。
 */
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DynamicCrudController {
  constructor(private readonly svc: DynamicCrudService) {}

  @Get(':table(kuyou_[A-Za-z0-9_]+)/index')
  index(@Param('table') table: string, @Query() q: QueryParams, @CurrentUser() user: any) {
    return this.svc.list(table, q, user).then((r) => tableResp(r.total, r.rows));
  }

  @Get(':table(kuyou_[A-Za-z0-9_]+)/selectpage')
  selectpage(@Param('table') table: string, @Query() q: QueryParams, @CurrentUser() user: any) {
    return this.svc.selectpage(table, q, user);
  }

  @Get(':table(kuyou_[A-Za-z0-9_]+)/detail/:id')
  async detail(@Param('table') table: string, @Param('id') id: string, @CurrentUser() user: any) {
    return ok(await this.svc.detail(table, id, user));
  }

  @Post(':table(kuyou_[A-Za-z0-9_]+)/add')
  async add(@Param('table') table: string, @Body() body: any) {
    const r = await this.svc.add(table, body);
    return ok(r, '新增成功');
  }

  @Post(':table(kuyou_[A-Za-z0-9_]+)/edit')
  async edit(@Param('table') table: string, @Body() body: any, @CurrentUser() user: any) {
    const r = await this.svc.edit(table, body, user);
    return ok(r, '保存成功');
  }

  @Post(':table(kuyou_[A-Za-z0-9_]+)/del')
  async del(@Param('table') table: string, @Body() body: any, @CurrentUser() user: any) {
    const ids = body?.ids ?? body?.id;
    const r = await this.svc.del(table, String(ids), user);
    return ok(r, '删除成功');
  }

  /**
   * 批量操作（对应 FastAdmin 通用 multi）
   */
  @Post(':table(kuyou_[A-Za-z0-9_]+)/multi')
  async multi(@Param('table') table: string, @Body() body: any, @CurrentUser() user: any) {
    const ids = body?.ids ?? body?.id;
    const r = await this.svc.multi(table, String(ids), body?.params ?? body, user);
    return ok(r, '操作成功');
  }
}
