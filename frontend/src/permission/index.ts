import { reactive } from 'vue';
import { permOf } from '../config/menu';

/**
 * 前端权限状态（登录时由后端返回，刷新时从 localStorage 还原）。
 * 权限码约定：
 *   menu:<table|key>        菜单/列表接口权限
 *   button:<table>:<action> 按钮/写接口权限（action: add|edit|delete|import|export）
 *   rbac:*                  后台管理类权限
 *   *                        超级管理员通配
 */
export interface PermState {
  ready: boolean;
  permissions: Set<string>;
  isSuper: boolean;
  dataScope: string; // all | custom
  stores: number[] | null; // 数据权限授权仓库（custom 时有效）
  roleId: number;
  roleName: string;
}

export const permState = reactive<PermState>({
  ready: false,
  permissions: new Set<string>(),
  isSuper: false,
  dataScope: 'all',
  stores: null,
  roleId: 0,
  roleName: '',
});

export interface PermPayload {
  permissions?: string[];
  dataScope?: string;
  stores?: number[] | null;
  roleId?: number;
  roleName?: string;
}

export function setPermissions(p: PermPayload) {
  permState.permissions = new Set(p.permissions || []);
  permState.isSuper = permState.permissions.has('*');
  permState.dataScope = p.dataScope || 'all';
  permState.stores = p.stores ?? null;
  permState.roleId = p.roleId || 0;
  permState.roleName = p.roleName || '';
  permState.ready = true;
}

/** 是否拥有至少一个给定权限码（* 通配直接通过） */
export function hasPerm(...codes: string[]): boolean {
  if (permState.isSuper) return true;
  return codes.some((c) => permState.permissions.has(c));
}

/** 菜单项/路由是否可访问：映射出权限码后判定（无权限码则放行） */
export function canAccess(to: string): boolean {
  const code = permOf(to);
  if (!code) return true;
  return hasPerm(code);
}
