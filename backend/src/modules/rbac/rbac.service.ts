import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RbacRole, RbacPermission, RbacRolePermission, RbacRoleStore } from '../../entities/rbac.entity';
import { Admin } from '../auth/admin.entity';

/** 角色权限/数据范围缓存（角色数少，整体失效即可） */
interface RoleCache {
  perms: string[];
  dataScope: string;
  storeIds: number[] | null;
}
const cache = new Map<number, RoleCache>();

function permTypeOf(code: string): string {
  if (code === '*') return '*';
  if (code.startsWith('button:')) return 'button';
  if (code.startsWith('api:')) return 'api';
  if (code.startsWith('menu:')) return 'menu';
  return 'menu';
}

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(RbacRole) private roleRepo: Repository<RbacRole>,
    @InjectRepository(RbacPermission) private permRepo: Repository<RbacPermission>,
    @InjectRepository(RbacRolePermission) private rpRepo: Repository<RbacRolePermission>,
    @InjectRepository(RbacRoleStore) private rsRepo: Repository<RbacRoleStore>,
    @InjectRepository(Admin) private adminRepo: Repository<Admin>,
  ) {}

  private clearCache() {
    cache.clear();
  }

  /** 取角色权限码集合；roleId 为 0（未分配）视为超级管理员，拥有通配 * */
  async getPermissions(roleId: number): Promise<string[]> {
    if (!roleId) return ['*'];
    const c = cache.get(roleId);
    if (c) return c.perms;
    const rp = await this.rpRepo.find({ where: { roleId } });
    const permIds = rp.map((r) => r.permissionId);
    let perms: string[] = [];
    if (permIds.length) {
      const ps = await this.permRepo.findByIds(permIds);
      perms = ps.map((p) => p.code);
    }
    const scope = await this.getDataScope(roleId);
    cache.set(roleId, { perms, dataScope: scope.dataScope, storeIds: scope.storeIds });
    return perms;
  }

  /** 取角色基本信息（roleId 为 0 返回 null） */
  async getRole(roleId: number): Promise<RbacRole | null> {
    if (!roleId) return null;
    return this.roleRepo.findOne({ where: { id: roleId } });
  }

  /** 取角色数据范围与授权仓库；roleId 为 0 视为全部 */
  async getDataScope(roleId: number): Promise<{ dataScope: string; storeIds: number[] | null }> {
    if (!roleId) return { dataScope: 'all', storeIds: null };
    const c = cache.get(roleId);
    if (c) return { dataScope: c.dataScope, storeIds: c.storeIds };
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role || role.dataScope === 'all') return { dataScope: 'all', storeIds: null };
    const rows = await this.rsRepo.find({ where: { roleId } });
    return { dataScope: role.dataScope, storeIds: rows.map((r) => r.storeId) };
  }

  // ----------------- 角色 CRUD -----------------
  async listRoles() {
    return this.roleRepo.find({ order: { sort: 'ASC', id: 'ASC' } });
  }

  async createRole(dto: Partial<RbacRole>) {
    const now = Date.now();
    const role = this.roleRepo.create({
      name: dto.name || '',
      code: dto.code || '',
      dataScope: dto.dataScope || 'all',
      status: dto.status || 'normal',
      sort: dto.sort || 0,
      remark: dto.remark,
      createtime: now,
      updatetime: now,
    });
    const saved = await this.roleRepo.save(role);
    this.clearCache();
    return saved;
  }

  async updateRole(id: number, dto: Partial<RbacRole>) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('角色不存在');
    Object.assign(role, {
      name: dto.name ?? role.name,
      code: dto.code ?? role.code,
      dataScope: dto.dataScope ?? role.dataScope,
      status: dto.status ?? role.status,
      sort: dto.sort ?? role.sort,
      remark: dto.remark ?? role.remark,
      updatetime: Date.now(),
    });
    const saved = await this.roleRepo.save(role);
    this.clearCache();
    return saved;
  }

  async deleteRole(id: number) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('角色不存在');
    if (role.code === 'super_admin') throw new Error('超级管理员角色不可删除');
    await this.rpRepo.delete({ roleId: id });
    await this.rsRepo.delete({ roleId: id });
    await this.adminRepo.update({ roleId: id }, { roleId: 0 });
    await this.roleRepo.delete(id);
    this.clearCache();
    return { success: true };
  }

  // ----------------- 权限分配 -----------------
  async getRoleDetail(id: number) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('角色不存在');
    const rp = await this.rpRepo.find({ where: { roleId: id } });
    const permIds = rp.map((r) => r.permissionId);
    const perms = permIds.length
      ? await this.permRepo.findByIds(permIds)
      : [];
    const stores = (await this.rsRepo.find({ where: { roleId: id } })).map((r) => r.storeId);
    return {
      ...role,
      permissions: perms.map((p) => p.code),
      stores,
    };
  }

  /** 设置角色权限码（codes 为权限码数组，如 ['menu:kuyou_goods','button:kuyou_goods:add','*']） */
  async setRolePermissions(roleId: number, codes: string[]) {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('角色不存在');
    // 确保权限码已落库
    for (const code of codes) {
      const exist = await this.permRepo.findOne({ where: { code } });
      if (!exist) {
        await this.permRepo.save(
          this.permRepo.create({ code, type: permTypeOf(code), name: code, parentId: 0, sort: 0 }),
        );
      }
    }
    const perms = await this.permRepo.find({ where: codes.map((code) => ({ code })) });
    await this.rpRepo.delete({ roleId });
    await this.rpRepo.save(
      perms.map((p) => this.rpRepo.create({ roleId, permissionId: p.id })),
    );
    this.clearCache();
    return { success: true, count: perms.length };
  }

  /** 设置角色可访问仓库（数据权限 custom 时生效） */
  async setRoleStores(roleId: number, storeIds: number[]) {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('角色不存在');
    await this.rsRepo.delete({ roleId });
    if (storeIds?.length) {
      await this.rsRepo.save(storeIds.map((sid) => this.rsRepo.create({ roleId, storeId: sid })));
    }
    this.clearCache();
    return { success: true, count: storeIds?.length || 0 };
  }

  // ----------------- 管理员角色分配 -----------------
  async listAdmins() {
    return this.adminRepo.find({
      select: ['id', 'username', 'nickname', 'status', 'roleId', 'logintime'],
      order: { id: 'ASC' },
    });
  }

  async setAdminRole(adminId: number, roleId: number) {
    const admin = await this.adminRepo.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('管理员不存在');
    if (roleId) {
      const role = await this.roleRepo.findOne({ where: { id: roleId } });
      if (!role) throw new NotFoundException('角色不存在');
    }
    await this.adminRepo.update(adminId, { roleId, updatetime: Date.now() });
    return { success: true };
  }
}
