import { Module } from '@nestjs/common';
import { DynamicCrudService } from './dynamic-crud.service';
import { DynamicCrudController } from './dynamic-crud.controller';
import { RbacModule } from '../../rbac/rbac.module';

/**
 * 动态 CRUD 模块
 * 用一张通用控制器覆盖全部 156 张 kuyou_ 表的标准增删改查，
 * 路由与原 kuyou FastAdmin 的 /kuyou/<模块>/<方法> 一致。
 * 引入 RbacModule 以使用 PermissionsGuard 与数据权限所需的 RbacService。
 */
@Module({
  imports: [RbacModule],
  controllers: [DynamicCrudController],
  providers: [DynamicCrudService],
  // 导出供 DocumentModule 复用列表能力（带业务固定过滤的虚拟单据页）
  exports: [DynamicCrudService],
})
export class DynamicCrudModule {}
