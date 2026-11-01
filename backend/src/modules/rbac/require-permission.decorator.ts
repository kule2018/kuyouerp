import { SetMetadata } from '@nestjs/common';

/**
 * 标记接口所需权限码。
 * 不传参时由 PermissionsGuard 根据路由自动派生：
 *   GET  /:table/index      -> menu:<table>
 *   POST /:table/add        -> button:<table>:add
 *   POST /:table/edit       -> button:<table>:edit
 *   POST /:table/del        -> button:<table>:delete
 *   POST /:table/import     -> button:<table>:import
 *   POST /:table/export     -> button:<table>:export
 * 传参时直接使用给定码（支持多个，满足其一即可）。
 */
export const REQUIRE_PERMISSION_KEY = 'requirePermission';
export const RequirePermission = (...codes: string[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, codes);
