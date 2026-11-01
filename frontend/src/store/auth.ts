/**
 * 简易鉴权状态（localStorage 持久化）
 * 登录返回的整体 data（含 token / user / permissions / dataScope / stores）统一存一份，
 * 刷新后由 initPermissionStore() 还原权限，避免菜单/按钮在刷新后全被隐藏。
 */
import { setPermissions, type PermPayload } from '../permission';

const KEY = 'kuyou_auth';

export interface AuthData {
  token: string;
  user: any;
  permissions?: string[];
  dataScope?: string;
  stores?: number[] | null;
  roleId?: number;
  roleName?: string;
}

export function setAuth(data: AuthData) {
  localStorage.setItem(KEY, JSON.stringify(data));
  // 兼容请求拦截器与旧代码读取的 'token'/'user' 键（拦截器据此注入 Authorization）
  if (data.token) localStorage.setItem('token', data.token);
  if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
  applyPerm(data);
}

function applyPerm(d: AuthData) {
  const roleId = d.roleId ?? d.user?.roleId ?? 0;
  const roleName = d.roleName ?? d.user?.roleName ?? '';
  const p: PermPayload = {
    permissions: d.permissions || [],
    dataScope: d.dataScope || 'all',
    stores: d.stores ?? null,
    roleId,
    roleName,
  };
  setPermissions(p);
}

export function getAuth(): AuthData | null {
  const raw = localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as AuthData) : null;
}

export function getToken(): string {
  return getAuth()?.token || '';
}

export function getUser(): any {
  return getAuth()?.user || null;
}

export function clearAuth() {
  localStorage.removeItem(KEY);
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  setPermissions({ permissions: [], dataScope: 'all', stores: null, roleId: 0, roleName: '' });
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

/** 应用启动早期调用：把持久化的权限还原到响应式状态 */
export function initPermissionStore() {
  const a = getAuth();
  if (a) applyPerm(a);
}

/**
 * 启动后用当前 token 向服务端拉取最新权限，覆盖可能陈旧的本地缓存。
 * 避免“后端改了权限/角色，但前端仍用旧 localStorage 权限导致菜单点不动/被守卫拦回首页”的问题。
 * 采用动态 import 以避免与 request -> router -> store/auth 形成循环依赖。
 */
export async function refreshAuth() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const mod = await import('../utils/request');
    const request = mod.default;
    const d: any = await request({ url: 'rbac/me', method: 'get' });
    if (!d || !d.data) return;
    const prev = getAuth() || ({} as AuthData);
    const payload = d.data;
    const merged: AuthData = {
      ...prev,
      permissions: payload.permissions,
      dataScope: payload.dataScope,
      stores: payload.stores,
      roleId: payload.roleId,
      roleName: payload.roleName,
    };
    localStorage.setItem(KEY, JSON.stringify(merged));
    applyPerm(merged);
  } catch {
    /* 拉取失败不阻塞启动，沿用本地缓存 */
  }
}
