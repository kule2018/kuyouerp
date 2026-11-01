import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { isLoggedIn } from '../store/auth';
import { canAccess } from '../permission';

/**
 * 路由表
 * - /login 公开
 * - 其余页面置于布局内，需登录（全局守卫校验 token）
 * - ERP 基础资料 / 报表走 /crud/:table 通用 CRUD 页（由 config/modules.ts 元数据驱动）
 * - 业务单据（主从表 + 审核）走 /doc/:table 通用单据页（由 config/documents.ts 驱动）
 * - 报表走 /report/:key 通用报表页（由后端 report.config.ts 生成元数据）
 * - 专项业务（带计算逻辑）走 /special/:type，共六个页面
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/login.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('../views/layout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'dashboard', component: () => import('../views/dashboard.vue') },
      { path: 'crud/:table', name: 'crud', component: () => import('../views/crud.vue') },
      { path: 'doc/:table', name: 'document', component: () => import('../views/document.vue') },
      { path: 'report/:key', name: 'report', component: () => import('../views/report.vue') },
      { path: 'special/:type', name: 'special', component: () => import('../views/special.vue') },
      { path: 'invoicing/:kind', name: 'invoice', component: () => import('../views/invoicing.vue') },
      { path: 'bom', name: 'bom', component: () => import('../views/bom.vue') },
      { path: 'prints', name: 'prints', component: () => import('../views/prints.vue') },
      { path: 'intercourse', name: 'intercourse', component: () => import('../views/intercourse.vue') },
      { path: 'recon', name: 'recon', component: () => import('../views/recon.vue') },
      { path: 'summary', name: 'summary', component: () => import('../views/summary.vue') },
      { path: 'datainfo', name: 'datainfo', component: () => import('../views/datainfo.vue') },
      { path: 'production-cost', name: 'production-cost', component: () => import('../views/production-cost.vue') },
      { path: 'production-panel', name: 'production-panel', component: () => import('../views/production-panel.vue') },
      { path: 'pos', name: 'pos', component: () => import('../views/pos.vue') },
      { path: 'ai', name: 'ai', component: () => import('../views/ai.vue') },
      { path: 'finance', name: 'finance', component: () => import('../views/finance.vue') },
      { path: 'stocktake', name: 'stocktake', component: () => import('../views/stocktake.vue') },
      { path: 'logs', name: 'logs', component: () => import('../views/logs.vue') },
      // 系统设置（kind=system 系统设置 / kind=user 用户设置）：表单式键值配置，非表 CRUD
      { path: 'settings/:kind', name: 'settings', component: () => import('../views/settings.vue') },
      // 权限管理
      { path: 'rbac/roles', name: 'rbac-roles', component: () => import('../views/rbac/roles.vue') },
      { path: 'rbac/admins', name: 'rbac-admins', component: () => import('../views/rbac/admins.vue') },
      // 单据编号规则：前缀 + 日期段 + 流水号，带实时示例预览
      { path: 'prefix', name: 'prefix', component: () => import('../views/prefix.vue') },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  if (to.meta.public) {
    next();
  } else if (!isLoggedIn()) {
    next('/login');
  } else if (!canAccess(to.fullPath)) {
    // 无菜单权限：根目录/首页放行，其余跳首页（避免死循环）
    if (to.path === '/' || to.path === '/dashboard') next();
    else next('/dashboard');
  } else {
    next();
  }
});

export default router;
