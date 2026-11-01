import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY } from '../../modules/rbac/require-permission.decorator';
import { RbacService } from '../../modules/rbac/rbac.service';

/**
 * 接口权限守卫。
 * - 路由标注 @RequirePermission('a','b') 时，用户需拥有其一；
 * - 未标注时，按动态 CRUD 路由自动派生：读=menu:<table>，写=button:<table>:<action>；
 * - 用户拥有通配 * 时直接放行；
 * - 角色 id 为 0（未分配角色）视为超级管理员，拥有 *。
 *
 * 注意：本守卫与 JwtAuthGuard 配合，需在控制器上以
 *   @UseGuards(JwtAuthGuard, PermissionsGuard)
 * 声明，保证鉴权先于权限校验执行（req.user 已就绪）。
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return true; // 无登录态由 JwtAuthGuard 负责拦截

    const roleId = (user as any).roleId ?? 0;
    const perms = await this.rbac.getPermissions(roleId);
    if (perms.includes('*')) return true;

    let required = this.reflector.getAllAndOverride<string[]>(REQUIRE_PERMISSION_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) required = this.derive(req);
    if (!required || required.length === 0) return true; // 未声明的接口对认证用户开放

    if (!required.some((c) => perms.includes(c))) {
      throw new ForbiddenException('无访问权限');
    }
    return true;
  }

  /** 动态 CRUD 路由按约定派生权限码 */
  private derive(req: any): string[] {
    const table = req.params?.table;
    if (!table) return [];
    const path: string = req.route?.path || '';
    const method = req.method;
    if (path.endsWith('/index') || path === '/:table') {
      if (method === 'GET' || method === 'POST') return [`menu:${table}`];
    }
    if (path.endsWith('/add')) return [`button:${table}:add`];
    if (path.endsWith('/edit')) return [`button:${table}:edit`];
    if (path.endsWith('/del')) return [`button:${table}:delete`];
    if (path.endsWith('/import')) return [`button:${table}:import`];
    if (path.endsWith('/export')) return [`button:${table}:export`];
    return [];
  }
}
