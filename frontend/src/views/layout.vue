<template>
  <div class="layout">
    <!-- 侧边栏：Logo + 导航菜单 -->
    <aside class="aside">
      <div class="logo">kuyou ERP</div>
      <div class="menu-wrap">
        <DsMenu :model-value="activeMenu" :items="menuItems" @select="onSelect" />
      </div>
    </aside>

    <!-- 主区：顶栏 + 内容 -->
    <div class="body">
      <header class="header">
        <span class="header-title">进销存管理系统</span>
        <span class="header-user">
          <DsButton variant="text" size="sm" :title="isDark ? '切换浅色' : '切换深色'" @click="toggleTheme">
            {{ isDark ? '☀ 浅色' : '☾ 深色' }}
          </DsButton>
          {{ user?.nickname || user?.username }}
          <DsButton variant="text" size="sm" @click="logout">退出</DsButton>
        </span>
      </header>
      <main class="main">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getUser, clearAuth } from '../store/auth';
import { useTheme } from '@/components/ds/theme';
import type { NavItem } from '@/components/ds/types';
import { permOf } from '../config/menu';
import { hasPerm } from '../permission';

/** 菜单图标（24x24 线性 SVG path） */
const ICONS: Record<string, string> = {
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  ai: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z',
  print: 'M6 9V3h12v6 M6 18H4v-6h16v6h-2 M8 14h8v7H8z',
  postcard: 'M4 5h16v14H4z M4 9h16 M8 13h4',
  notebook: 'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6',
  chart: 'M3 21h18 M6 21V11 M12 21V5 M18 21v-6',
  histogram: 'M3 21h18 M7 21v-7 M12 21V5 M17 21v-11',
  cart: 'M3 4h2l2.4 12.2a2 2 0 0 0 2 1.8h7.7a2 2 0 0 0 2-1.6L21 8H6 M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2 M17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  operation: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  ticket: 'M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-6z M13 5v14',
  box: 'M20 7l-8-4-8 4v10l8 4 8-4z M4 7l8 4 8-4 M12 11v10',
  money: 'M12 3v18 M17 7H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  user: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  files: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M14 3v6h6',
  more: 'M5 12h.01 M12 12h.01 M19 12h.01',
};

const route = useRoute();
const router = useRouter();
const user = getUser();
const { isDark, toggleTheme } = useTheme();

/**
 * 当前高亮菜单项。
 * 必须把 query 一起带上：菜单里存在「同路径不同 query」的入口
 * （采购附件 `/crud/kuyou_enclosure?type=1`、销售附件 `?type=2`），
 * 只传 route.path 的话两个入口既无法区分谁被激活，父级也不会自动展开。
 */
const activeMenu = computed(() => {
  const q = route.query || {};
  const keys = Object.keys(q).filter((k) => q[k] !== undefined && q[k] !== '');
  if (!keys.length) return route.path;
  const qs = keys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(q[k]))}`)
    .join('&');
  return `${route.path}?${qs}`;
});

/** 分组 -> 图标（覆盖源系统 10 个一级分组 + 嵌套子分组） */
function iconOf(group: string): string {
  const map: Record<string, string> = {
    数据面板: ICONS.histogram,
    购货: ICONS.box,
    销货: ICONS.chart,
    零售: ICONS.cart,
    生产: ICONS.gear,
    仓库: ICONS.box,
    资金: ICONS.money,
    资料: ICONS.files,
    设置: ICONS.gear,
    订货通: ICONS.notebook,
    辅助资料: ICONS.files,
    计量单位: ICONS.files,
  };
  return map[group] || ICONS.files;
}

/**
 * 左侧导航：严格按源系统 Kuyou.php 的 $menu 树（10 个一级分组）一比一还原。
 * 每个子项映射到目标既有路由：
 *   /doc/:table        主从单据（documents.ts）
 *   /crud/:table       基础资料 / 台账（modules.ts）
 *   /report/:key       报表（reports.ts）
 *   /special/:type     专项业务（mrp/replenishment/sold/wages/checkout/init）
 *   /invoicing/:kind   开票中心
 *   /intercourse /recon /datainfo /pos /bom /prints /settings/:kind 专用页
 */
const RAW_MENU: NavItem[] = [
  { label: '仪表盘', to: '/dashboard', icon: ICONS.dashboard },
  { label: 'AI 助手', to: '/ai', icon: ICONS.ai },

  /* 数据面板 */
  {
    label: '数据面板', to: 'group:数据面板', icon: ICONS.histogram,
    children: [
      { label: '数据中心', to: '/datainfo' },
      { label: '生产数据面板', to: '/production-panel' },
    ],
  },

  /* 购货 */
  {
    label: '购货', to: 'group:购货', icon: ICONS.box,
    children: [
      { label: '购货订单', to: '/doc/kuyou_goods_purchase_order' },
      { label: '购货单', to: '/doc/kuyou_goods_purchase' },
      { label: '购货退货单', to: '/doc/kuyou_goods_exchange' },
      { label: '采购明细表', to: '/report/purchase_detail' },
      { label: '采购订单跟踪表', to: '/report/purchase_order_trace' },
      { label: '采购汇总表(商品)', to: '/report/purchase_summary_goods' },
      { label: '采购汇总表(供应商)', to: '/report/purchase_summary_supplier' },
      { label: '采购付款一览表', to: '/report/purchase_payment_list' },
      { label: '采购开票管理', to: '/invoicing/purchase' },
      { label: '以销定购看板', to: '/special/sold' },
      { label: '智能补货', to: '/special/replenishment' },
      { label: '原始单据', to: '/crud/kuyou_enclosure?type=1' },
    ],
  },

  /* 销货 */
  {
    label: '销货', to: 'group:销货', icon: ICONS.chart,
    children: [
      { label: '销货订单', to: '/doc/kuyou_goods_sales_order' },
      { label: '销货单', to: '/doc/kuyou_goods_sales' },
      { label: '销货退货单', to: '/doc/kuyou_goods_sales_exchange' },
      { label: '销售订单跟踪表', to: '/report/sales_order_trace' },
      { label: '商品销售明细', to: '/report/sales_detail' },
      { label: '销货开票管理', to: '/invoicing/sales' },
      { label: '销货收款一览表', to: '/report/sales_collection_list' },
      { label: '销售汇总表(按商品)', to: '/report/sales_summary_goods' },
      { label: '销售汇总表(按客户)', to: '/report/sales_summary_customer' },
      { label: '销售汇总表(按销售员)', to: '/report/sales_summary_user' },
      { label: '销售利润表', to: '/report/sales_profit' },
      { label: '销售排行表', to: '/report/sales_rank' },
      { label: '往来单位欠款表', to: '/intercourse' },
      { label: '原始单据', to: '/crud/kuyou_enclosure?type=2' },
    ],
  },

  /* 零售 */
  {
    label: '零售', to: 'group:零售', icon: ICONS.cart,
    children: [
      { label: '零售单', to: '/pos' },
      { label: '零售退货单', to: '/doc/kuyou_retail_sales_exchange' },
    ],
  },

  /* 生产 */
  {
    label: '生产', to: 'group:生产', icon: ICONS.gear,
    children: [
      { label: 'BOM清单', to: '/bom' },
      { label: 'BOM工序', to: '/bom?tab=procedure' },
      { label: '生产计划', to: '/doc/kuyou_plan' },
      { label: 'MRP计算', to: '/special/mrp' },
      { label: '生产单', to: '/doc/kuyou_production' },
      { label: '领料单', to: '/doc/kuyou_picking' },
      { label: '退料单', to: '/doc/kuyou_material' },
      { label: '委外加工单', to: '/doc/kuyou_outsourcing' },
      { label: '验收单', to: '/doc/kuyou_acceptance' },
      { label: '生产成本', to: '/production-cost' },
      { label: '计件工资', to: '/special/wages?wage=piece' },
      { label: '计时工资', to: '/special/wages?wage=hour' },
    ],
  },

  /* 仓库 */
  {
    label: '仓库', to: 'group:仓库', icon: ICONS.box,
    children: [
      { label: '调拨单', to: '/doc/kuyou_allocation' },
      { label: '成本调整单', to: '/doc/kuyou_adjustment' },
      { label: '盘点', to: '/doc/kuyou_inventory' },
      { label: '序列号盘点', to: '/doc/kuyou_inventory_serial' },
      { label: '其他入库单', to: '/doc/kuyou_warehousing' },
      { label: '其他出库单', to: '/doc/kuyou_warehouse' },
      { label: '组装单', to: '/doc/kuyou_assemble' },
      { label: '拆卸单', to: '/doc/kuyou_split' },
      { label: '库存预警', to: '/report/stock_warning' },
      { label: '商品库存余额表', to: '/report/stock_balance' },
      { label: '批次跟踪表', to: '/report/batch_trace' },
      { label: '商品收发明细表', to: '/report/goods_io_detail' },
      { label: '商品收发汇总表', to: '/report/goods_io_summary' },
      { label: '序列号跟踪表', to: '/report/serial_trace' },
      { label: '序列号状态表', to: '/report/serial_status' },
      { label: '序列号状态表', to: '/recon?type=serial' },
      { label: '批次保质期清单', to: '/report/batch_validity' },
      { label: '库存盘点过账', to: '/stocktake' },
    ],
  },

  /* 资金 */
  {
    label: '资金', to: 'group:资金', icon: ICONS.money,
    children: [
      { label: '付款单', to: '/doc/kuyou_payment' },
      { label: '收款单', to: '/doc/kuyou_collection' },
      { label: '核销单', to: '/doc/kuyou_writeoff' },
      { label: '应收账款明细表', to: '/report/receivable_detail' },
      { label: '应付账款明细表', to: '/report/payable_detail' },
      { label: '其他收入单', to: '/doc/kuyou_income' },
      { label: '采购销售费用清单', to: '/report/purchase_sale_expense' },
      { label: '费用单', to: '/doc/kuyou_cost' },
      { label: '其他支出单', to: '/doc/kuyou_expenditure' },
      { label: '资金转账单', to: '/doc/kuyou_accounts_transfer' },
      { label: '现金银行报表', to: '/report/cash_bank_report' },
      { label: '客户对账单', to: '/recon?type=customer' },
      { label: '供应商对账单', to: '/recon?type=supplier' },
      { label: '其他收支明细表', to: '/report/other_income_detail' },
      { label: '利润表', to: '/report/profit_report' },
      { label: '收付款核销', to: '/finance' },
    ],
  },

  /* 资料（基础资料） */
  {
    label: '资料', to: 'group:资料', icon: ICONS.files,
    children: [
      { label: '委外工厂管理', to: '/crud/kuyou_factory' },
      { label: '车间管理', to: '/crud/kuyou_workshop' },
      { label: '客户列表', to: '/crud/kuyou_customers' },
      { label: '供应商管理', to: '/crud/kuyou_suppliers' },
      { label: '账户管理', to: '/crud/kuyou_accounts' },
      { label: '商品管理', to: '/crud/kuyou_goods' },
      { label: '仓库管理', to: '/crud/kuyou_stores' },
      { label: '职员管理', to: '/crud/kuyou_staff_member' },
      { label: '自取地址管理', to: '/crud/kuyou_address' },
      { label: '司机管理', to: '/crud/kuyou_driver' },
      {
        label: '辅助资料', to: 'group:辅助资料', icon: ICONS.files,
        children: [
          { label: '客户等级', to: '/crud/kuyou_customerlevel' },
          { label: '供应商分类', to: '/crud/kuyou_supplyertype' },
          { label: '客户分类', to: '/crud/kuyou_customertype' },
          { label: '商品分类', to: '/crud/kuyou_goods_type' },
          { label: '支出类别管理', to: '/crud/kuyou_expend_type' },
          { label: '收入类别管理', to: '/crud/kuyou_income_type' },
          { label: '结算方式', to: '/crud/kuyou_settlementtype' },
          {
            label: '计量单位', to: 'group:计量单位',
            children: [
              { label: '单计量单位', to: '/crud/kuyou_unit' },
              { label: '多计量单位', to: '/crud/kuyou_unit_conversion' },
            ],
          },
          { label: '商品辅助属性', to: '/crud/kuyou_auxiliary' },
          { label: '客户物料编码', to: '/crud/kuyou_customer_goodscoding' },
        ],
      },
    ],
  },

  /* 设置（系统设置） */
  {
    label: '设置', to: 'group:设置', icon: ICONS.gear,
    children: [
      { label: '系统参数', to: '/settings/system' },
      { label: '系统初始化', to: '/special/init' },
      { label: '结账/反结账', to: '/special/checkout' },
      { label: '三方账号管理', to: '/crud/kuyou_third_account' },
      { label: '单据编号规则', to: '/prefix' },
      { label: '操作日志/导出', to: '/logs' },
      { label: '角色管理', to: '/rbac/roles' },
      { label: '管理员管理', to: '/rbac/admins' },
    ],
  },

  /* 订货通 */
  {
    label: '订货通', to: 'group:订货通', icon: ICONS.notebook,
    children: [
      { label: '轮播管理', to: '/crud/kuyou_banner' },
      { label: '订货单管理', to: '/doc/kuyou_user_order' },
      { label: '系统配置', to: '/settings/user' },
      { label: '用户管理', to: '/crud/kuyou_user' },
    ],
  },

  /* 目标端增强页（源系统无对应独立入口，保留以不丢失功能） */
  { label: '打印中心', to: '/prints', icon: ICONS.print },
  { label: '汇总报表', to: '/summary', icon: ICONS.chart },
];

/** 按当前用户权限过滤菜单（菜单权限码 = permOf(to)） */
function filterMenu(items: NavItem[]): NavItem[] {
  const out: NavItem[] = [];
  for (const it of items) {
    if (it.children?.length) {
      const kids = filterMenu(it.children);
      if (kids.length) out.push({ ...it, children: kids });
    } else {
      const code = permOf(it.to);
      if (!code || hasPerm(code)) out.push(it);
    }
  }
  return out;
}
const menuItems = computed<NavItem[]>(() => filterMenu(RAW_MENU));

/** 菜单点击：叶子节点跳转路由 */
function onSelect(item: NavItem) {
  router.push(item.to);
}

/** 退出登录 */
function logout() {
  clearAuth();
  router.replace('/login');
}
</script>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
.aside {
  width: 240px;
  flex: none;
  display: flex;
  flex-direction: column;
  background: var(--ds-bg-soft);
  border-right: 1px solid var(--ds-border);
}
.logo {
  color: var(--ds-text);
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  padding: 18px 0;
  border-bottom: 1px solid var(--ds-border);
  flex: none;
}
.menu-wrap {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.header {
  height: 56px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--ds-bg-elevated);
  border-bottom: 1px solid var(--ds-border);
}
.header-title {
  font-weight: 600;
}
.header-user {
  display: flex;
  align-items: center;
  gap: 10px;
}
.main {
  flex: 1;
  overflow: auto;
  padding: 12px;
  background: var(--ds-bg);
}
</style>
