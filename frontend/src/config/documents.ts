/**
 * 主从单据的前端配置（与后端 src/modules/erp/document/document.config.ts 一一对应）
 *
 * 设计要点：
 *  - 字段中文名全部取自自动生成的 MODULES 元数据（schema.sql 的注释），无需在此重复维护
 *  - headerFields / lineFields 留空时由页面按元数据自动挑选可读列
 *  - 引用类列（商品 / 仓库 / 单位 / 客户 / 供应商 / 账户）通过 REF_MAP 自动挂上远端搜索选择器
 */

export interface DocConfig {
  /** 主表名，也是路由 :table */
  key: string;
  /**
   * 物理主表名（缺省等于 key）。
   * 零售单这类「同一张物理表按业务标识拆页」的配置需要显式指向真实表，
   * 例如 kuyou_retail_sales → kuyou_goods_sales。
   */
  header?: string;
  title: string;
  group: string;
  /** 明细表名 */
  detail?: string;
  /** 业务单号列 */
  codeField: string;
  /** 审核状态列（空串=无审核流程） */
  statusField: string;
  /** 表头表单字段（空则自动） */
  headerFields?: string[];
  /** 明细行表格列（空则自动） */
  lineFields?: string[];
  /** 金额联动配置：数量 × 单价 → 金额 */
  money?: { qty: string; price: string; money: string };
  /**
   * 工具栏「收银台」入口。
   * 源 retail/goods_sales 页在工具栏提供 `lay-event="retail"`，点击跳转 POS 收银台；
   * 迁移后由本标记驱动 document.vue 渲染该按钮并跳转 /pos。
   */
  pos?: boolean;
  /**
   * 合并生成下游单据（源 lay-event="merge_b"）。
   * 采购订单/销货订单勾选多张已审订单后，校验可生成数量再合并成一张入库单/出库单。
   * target 为目标单据的路由 key。
   */
  merge?: { label: string; target: string };
}

/**
 * 引用列 → 远端数据源映射
 * labelField 为下拉显示的字段，valueField 为回填到当前列的值
 */
export const REF_MAP: Record<string, { table: string; labelField: string; valueField: string }> = {
  goods_code: { table: 'kuyou_goods', labelField: 'goods_name', valueField: 'goods_code' },
  goods_id: { table: 'kuyou_goods', labelField: 'goods_name', valueField: 'goods_code' },
  suppliers_id: { table: 'kuyou_suppliers', labelField: 'supplyer_name', valueField: 'id' },
  supplyer_code: { table: 'kuyou_suppliers', labelField: 'supplyer_name', valueField: 'supplyer_code' },
  customers_id: { table: 'kuyou_customers', labelField: 'customer_name', valueField: 'id' },
  stores_id: { table: 'kuyou_stores', labelField: 'name', valueField: 'id' },
  stores_out: { table: 'kuyou_stores', labelField: 'name', valueField: 'id' },
  stores_enter: { table: 'kuyou_stores', labelField: 'name', valueField: 'id' },
  unit_id: { table: 'kuyou_unit', labelField: 'name', valueField: 'id' },
  goods_unit: { table: 'kuyou_unit', labelField: 'name', valueField: 'id' },
  // 批次：开启批次保质期管理的商品，明细行需选择具体批次，
  // 后端据此联动 kuyou_goods_batch_stock / batch_log / 批次明细子表
  batch_id: { table: 'kuyou_goods_batch', labelField: 'batch_name', valueField: 'id' },
  default_unit: { table: 'kuyou_unit', labelField: 'name', valueField: 'id' },
  accounts_id: { table: 'kuyou_accounts', labelField: 'account_name', valueField: 'id' },
  accounts_out_id: { table: 'kuyou_accounts', labelField: 'account_name', valueField: 'id' },
  accounts_enter_id: { table: 'kuyou_accounts', labelField: 'account_name', valueField: 'id' },
  income_type_id: { table: 'kuyou_income_type', labelField: 'name', valueField: 'id' },
  expend_type_id: { table: 'kuyou_expend_type', labelField: 'name', valueField: 'id' },
  cost_id: { table: 'kuyou_spendingtype', labelField: 'spending_type_name', valueField: 'id' },
  workshop_id: { table: 'kuyou_workshop', labelField: 'name', valueField: 'id' },
};

/** 购销类单据通用明细列（购货/销货及其订单、退货单） */
const TRADE_LINES = [
  'goods_code',
  'goods_note',
  'goods_attr',
  'goods_unit',
  'stores_id',
  'number',
  'unit_price',
  'discount',
  'dis_money',
  'tax_rate',
  'tax_money',
  'all_money',
  'remark',
];

/** 仓储类单据通用明细列（其他出入库 / 组装拆卸 / 调拨） */
const STOCK_LINES = [
  'goods_code',
  'goods_id',
  'goods_attr',
  'goods_unit',
  'stores_id',
  'stores_out',
  'stores_enter',
  'stock',
  'number',
  'unit_price',
  'price',
  'allow_stock',
  'batch',
  'remark',
];

export const DOCUMENTS: DocConfig[] = [
  /* 采购管理 */
  { key: 'kuyou_goods_purchase_order', title: '购货订单', group: '采购管理', detail: 'kuyou_goods_purchase_order_info', codeField: 'purchase_code', statusField: 'check_status', lineFields: TRADE_LINES, money: { qty: 'number', price: 'unit_price', money: 'all_money' }, merge: { label: '合并入库', target: 'kuyou_goods_purchase' } },
  { key: 'kuyou_goods_purchase', title: '购货单', group: '采购管理', detail: 'kuyou_goods_purchase_info', codeField: 'purchase_code', statusField: 'check_status', lineFields: TRADE_LINES, money: { qty: 'number', price: 'unit_price', money: 'all_money' } },
  { key: 'kuyou_goods_exchange', title: '购货退货单', group: '采购管理', detail: 'kuyou_goods_exchange_info', codeField: 'purchase_code', statusField: 'check_status', lineFields: TRADE_LINES, money: { qty: 'number', price: 'unit_price', money: 'all_money' } },
  /* 销售管理 */
  { key: 'kuyou_goods_sales_order', title: '销货订单', group: '销售管理', detail: 'kuyou_goods_sales_order_info', codeField: 'purchase_code', statusField: 'check_status', lineFields: TRADE_LINES, money: { qty: 'number', price: 'unit_price', money: 'all_money' }, merge: { label: '合并出库', target: 'kuyou_goods_sales' } },
  { key: 'kuyou_goods_sales', title: '销货单', group: '销售管理', detail: 'kuyou_goods_sales_info', codeField: 'purchase_code', statusField: 'check_status', lineFields: TRADE_LINES, money: { qty: 'number', price: 'unit_price', money: 'all_money' } },
  { key: 'kuyou_goods_sales_exchange', title: '销货退货单', group: '销售管理', detail: 'kuyou_goods_sales_exchange_info', codeField: 'purchase_code', statusField: 'check_status', lineFields: TRADE_LINES, money: { qty: 'number', price: 'unit_price', money: 'all_money' } },
  /* 零售业务：与销货单共用物理表，靠后端 fixedFilter 的 order_type=2 区分 */
  { key: 'kuyou_retail_sales', title: '零售单', group: '销售管理', header: 'kuyou_goods_sales', detail: 'kuyou_goods_sales_info', codeField: 'purchase_code', statusField: 'check_status', lineFields: TRADE_LINES, money: { qty: 'number', price: 'unit_price', money: 'all_money' }, pos: true },
  { key: 'kuyou_retail_sales_exchange', title: '零售退货单', group: '销售管理', header: 'kuyou_goods_sales_exchange', detail: 'kuyou_goods_sales_exchange_info', codeField: 'purchase_code', statusField: 'check_status', lineFields: TRADE_LINES, money: { qty: 'number', price: 'unit_price', money: 'all_money' } },
  /* 库存管理 */
  { key: 'kuyou_warehousing', title: '其他入库单', group: '库存管理', detail: 'kuyou_warehousing_info', codeField: 'purchase_code', statusField: 'examine_status', lineFields: STOCK_LINES, money: { qty: 'number', price: 'unit_price', money: 'price' } },
  { key: 'kuyou_warehouse', title: '其他出库单', group: '库存管理', detail: 'kuyou_warehouse_info', codeField: 'purchase_code', statusField: 'examine_status', lineFields: STOCK_LINES, money: { qty: 'number', price: 'unit_price', money: 'price' } },
  { key: 'kuyou_allocation', title: '调拨单', group: '库存管理', detail: 'kuyou_allocation_info', codeField: 'purchase_code', statusField: 'examine_status', lineFields: STOCK_LINES },
  { key: 'kuyou_assemble', title: '组装单', group: '库存管理', detail: 'kuyou_assemble_info', codeField: 'purchase_code', statusField: 'examine_status', lineFields: STOCK_LINES },
  { key: 'kuyou_split', title: '拆卸单', group: '库存管理', detail: 'kuyou_split_info', codeField: 'purchase_code', statusField: 'examine_status', lineFields: STOCK_LINES },
  { key: 'kuyou_adjustment', title: '成本调整单', group: '库存管理', detail: 'kuyou_adjustment_info', codeField: 'purchase_code', statusField: '' },
  { key: 'kuyou_inventory', title: '盘点单', group: '库存管理', detail: 'kuyou_inventory_info', codeField: 'purchase_code', statusField: '' },
  { key: 'kuyou_inventory_serial', title: '序列号盘点单', group: '库存管理', detail: 'kuyou_inventory_serial_info', codeField: 'purchase_code', statusField: '' },
  /* 财务管理 */
  { key: 'kuyou_collection', title: '收款单', group: '财务管理', codeField: 'purchase_code', statusField: 'examine_status' },
  { key: 'kuyou_payment', title: '付款单', group: '财务管理', codeField: 'purchase_code', statusField: 'examine_status' },
  { key: 'kuyou_accounts_transfer', title: '资金转账单', group: '财务管理', detail: 'kuyou_accounts_transfer_info', codeField: 'purchase_code', statusField: 'examine_status' },
  { key: 'kuyou_income', title: '其他收入单', group: '财务管理', detail: 'kuyou_income_info', codeField: 'purchase_code', statusField: 'examine_status' },
  { key: 'kuyou_expenditure', title: '其他支出单', group: '财务管理', detail: 'kuyou_expenditure_info', codeField: 'purchase_code', statusField: 'examine_status' },
  { key: 'kuyou_cost', title: '费用单', group: '财务管理', codeField: 'purchase_code', statusField: 'examine_status' },
  { key: 'kuyou_writeoff', title: '核销单', group: '财务管理', detail: 'kuyou_writeoff_info', codeField: 'purchase_code', statusField: 'examine_status' },
  { key: 'kuyou_user_order', title: '订货单', group: '销售管理', detail: 'kuyou_user_orderinfo', codeField: 'order_num', statusField: '' },
  /* 生产管理 */
  { key: 'kuyou_plan', title: '生产计划单', group: '生产管理', detail: 'kuyou_plan_info', codeField: 'purchase_code', statusField: 'examine_status' },
  { key: 'kuyou_production', title: '生产单', group: '生产管理', detail: 'kuyou_production_info', codeField: 'purchase_code', statusField: 'examine_status' },
  { key: 'kuyou_picking', title: '领料单', group: '生产管理', detail: 'kuyou_picking_info', codeField: 'purchase_code', statusField: 'examine_status' },
  { key: 'kuyou_material', title: '退料单', group: '生产管理', detail: 'kuyou_material_info', codeField: 'purchase_code', statusField: 'examine_status' },
  { key: 'kuyou_outsourcing', title: '委外加工单', group: '生产管理', detail: 'kuyou_outsourcing_info', codeField: 'purchase_code', statusField: 'examine_status' },
  { key: 'kuyou_acceptance', title: '验收单', group: '生产管理', detail: 'kuyou_acceptance_info', codeField: 'purchase_code', statusField: 'examine_status' },
];

/** 按主表名取单据配置 */
export function docConfig(table: string): DocConfig | undefined {
  return DOCUMENTS.find((d) => d.key === table);
}

/** 按业务分组归类（菜单渲染用） */
/**
 * 取单据对应的物理主表名
 * 用于删除等直接操作表的场景：零售单这类虚拟单据要落到真实表上。
 * @param key 单据 key（路由 :table）
 * @returns 物理表名
 */
export function physicalTableOf(key: string): string {
  return DOCUMENTS.find((d) => d.key === key)?.header || key;
}

export function groupedDocuments(): { group: string; items: DocConfig[] }[] {
  const map = new Map<string, DocConfig[]>();
  for (const d of DOCUMENTS) {
    if (!map.has(d.group)) map.set(d.group, []);
    map.get(d.group)!.push(d);
  }
  return Array.from(map, ([group, items]) => ({ group, items }));
}
