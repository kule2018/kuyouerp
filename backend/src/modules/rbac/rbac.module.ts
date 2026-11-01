import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  RbacRole,
  RbacPermission,
  RbacRolePermission,
  RbacRoleStore,
} from '../../entities/rbac.entity';
import { Admin } from '../auth/admin.entity';
import { RbacService } from './rbac.service';
import { RbacController } from './rbac.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

/**
 * 权限模块
 * - RbacService：角色/权限/仓库分配、权限与数据范围查询（带缓存）
 * - PermissionsGuard：接口权限校验（供 DynamicCrud / 本模块控制器使用）
 * - RbacController：角色、权限、管理员角色管理接口
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([RbacRole, RbacPermission, RbacRolePermission, RbacRoleStore, Admin]),
  ],
  controllers: [RbacController],
  providers: [RbacService, PermissionsGuard],
  exports: [RbacService, PermissionsGuard],
})
export class RbacModule {}
