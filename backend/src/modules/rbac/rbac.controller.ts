import { Controller, Get, Post, Put, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from './require-permission.decorator';
import { RbacService } from './rbac.service';
import { ok } from '../../common/utils/resp';

/**
 * 权限管理接口（路由 /kuyou/rbac/...）
 * 所有接口均要求登录，并二次校验 rbac:* 权限码（超级管理员持 * 通配）。
 */
@Controller('rbac')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RbacController {
  constructor(private readonly svc: RbacService) {}

  /** 当前管理员权限概要 GET /kuyou/rbac/me（仅登录校验，不卡权限，供前端启动刷新权限用） */
  @Get('me')
  async me(@Req() req: any) {
    const roleId = (req.user && (req.user.roleId ?? req.user.sub)) || 0;
    const perms = await this.svc.getPermissions(roleId);
    const scope = await this.svc.getDataScope(roleId);
    const role = await this.svc.getRole(roleId);
    return ok({
      roleId,
      roleName: role?.name || (roleId ? '' : '超级管理员'),
      permissions: perms,
      dataScope: scope.dataScope,
      stores: scope.storeIds,
    });
  }

  /** 角色列表 GET /kuyou/rbac/roles */
  @Get('roles')
  @RequirePermission('rbac:role:list')
  async listRoles() {
    return ok(await this.svc.listRoles());
  }

  /** 角色详情（含已分配权限码与仓库）GET /kuyou/rbac/roles/:id */
  @Get('roles/:id')
  @RequirePermission('rbac:role:list')
  async getRole(@Param('id') id: string) {
    return ok(await this.svc.getRoleDetail(Number(id)));
  }

  /** 新建角色 POST /kuyou/rbac/roles */
  @Post('roles')
  @RequirePermission('rbac:role:create')
  async createRole(@Body() body: any) {
    return ok(await this.svc.createRole(body));
  }

  /** 更新角色 PUT /kuyou/rbac/roles/:id */
  @Put('roles/:id')
  @RequirePermission('rbac:role:update')
  async updateRole(@Param('id') id: string, @Body() body: any) {
    return ok(await this.svc.updateRole(Number(id), body));
  }

  /** 删除角色 DELETE /kuyou/rbac/roles/:id */
  @Delete('roles/:id')
  @RequirePermission('rbac:role:delete')
  async deleteRole(@Param('id') id: string) {
    return ok(await this.svc.deleteRole(Number(id)));
  }

  /** 分配权限码 POST /kuyou/rbac/roles/:id/permissions  body:{codes:[]} */
  @Post('roles/:id/permissions')
  @RequirePermission('rbac:role:assign')
  async setPerms(@Param('id') id: string, @Body() body: any) {
    return ok(await this.svc.setRolePermissions(Number(id), body?.codes || []));
  }

  /** 分配仓库（数据权限 custom 时生效）POST /kuyou/rbac/roles/:id/stores  body:{storeIds:[]} */
  @Post('roles/:id/stores')
  @RequirePermission('rbac:role:assign')
  async setStores(@Param('id') id: string, @Body() body: any) {
    return ok(await this.svc.setRoleStores(Number(id), body?.storeIds || []));
  }

  /** 管理员列表 GET /kuyou/rbac/admins */
  @Get('admins')
  @RequirePermission('rbac:admin:list')
  async listAdmins() {
    return ok(await this.svc.listAdmins());
  }

  /** 设置管理员角色 POST /kuyou/rbac/admins/:id/role  body:{roleId} */
  @Post('admins/:id/role')
  @RequirePermission('rbac:admin:assign')
  async setAdminRole(@Param('id') id: string, @Body() body: any) {
    return ok(await this.svc.setAdminRole(Number(id), Number(body?.roleId) || 0));
  }
}
