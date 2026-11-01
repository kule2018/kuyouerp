import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

/** 角色 */
@Entity('rbac_role')
export class RbacRole {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, default: '' })
  name: string;

  @Column({ length: 50, default: '' })
  @Index({ unique: true })
  code: string;

  /** 数据权限范围：all=全部数据；custom=仅授权仓库 */
  @Column({ name: 'data_scope', length: 20, default: 'all' })
  dataScope: string;

  @Column({ length: 20, default: 'normal' })
  status: string;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @Column({ length: 255, nullable: true })
  remark: string;

  @Column({ name: 'createtime', type: 'bigint', nullable: true })
  createtime: number;

  @Column({ name: 'updatetime', type: 'bigint', nullable: true })
  updatetime: number;
}

/** 权限项（菜单/按钮/接口），code 唯一 */
@Entity('rbac_permission')
export class RbacPermission {
  @PrimaryGeneratedColumn()
  id: number;

  /** menu | button | api | *（通配） */
  @Column({ length: 20, default: 'menu' })
  type: string;

  @Column({ length: 120, default: '' })
  @Index({ unique: true })
  code: string;

  @Column({ length: 100, default: '' })
  name: string;

  @Column({ name: 'parent_id', type: 'int', default: 0 })
  parentId: number;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @Column({ length: 255, nullable: true })
  remark: string;
}

/** 角色-权限关联 */
@Entity('rbac_role_permission')
export class RbacRolePermission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'role_id', type: 'int' })
  @Index(['roleId', 'permissionId'], { unique: true })
  roleId: number;

  @Column({ name: 'permission_id', type: 'int' })
  permissionId: number;
}

/** 角色-仓库关联（数据权限：custom 时生效） */
@Entity('rbac_role_store')
export class RbacRoleStore {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'role_id', type: 'int' })
  @Index(['roleId', 'storeId'], { unique: true })
  roleId: number;

  @Column({ name: 'store_id', type: 'int' })
  storeId: number;
}
