/**
 * 打印模块类型配置（1:1 对齐 kuyou Prints.php 的 switch 分支）
 *
 * 两类：
 *  1) document：单据打印（按 id 取主表 + 明细，富化商品/单位/仓库/往来，算合计 + 人民币大写）
 *  2) summary ：汇总表打印（按检索条件取聚合数据，供报表打印）
 *
 * 字段说明见各接口注释。表名 / 列名均来自 table-meta，执行前经白名单校验。
 */

/** 往来方解析配置 */
export interface PartyConfig {
  table: string; // kuyou_suppliers / kuyou_customers
  by: 'code' | 'id'; // 按编码还是主键
  key: string; // 往来表上用于匹配的列（supplyer_code / id）
  headerField: string; // 主表上存放往来标识的列
  outField: 'suppliers' | 'customers'; // 输出到 row 的字段名（1:1 还原 PHP 赋值）
}

/** 单据打印配置 */
export interface DocPrintConfig {
  key: string;
  title: string;
  mode: 'document';
  header: string; // 主表名
  detail?: string; // 明细表名（无则为纯主表单据，如收付款/收支出）
  linkField: string; // 主表关联字段（purchase_code / allocation_id / id）
  detailLinkField?: string; // 明细表上的关联字段，默认同 linkField
  goodsBy: 'code' | 'id'; // 商品取数方式
  numberField: string; // 明细数量字段（退换货用 retreat_number）
  moneyField?: string; // 明细金额字段（adjustment=money / warehousing·warehouse=price / assemble·split=cost_money）
  moneyTypeFilter?: number; // 仅汇总 type=该值的明细（组装·拆分单）
  headerMoneyOverride?: boolean; // 退换货单：money_tax_price = real_money + preferential_money
  detailOutField?: string; // 明细输出字段名（默认 purchase_info，调拨单用 info_list）
  party?: PartyConfig;
  staff?: boolean; // 销售员（sale_user -> staff_member）
  accounts?: boolean; // 收付款单：含 account + sale 子表
  writeoff?: boolean; // 核销单：business_type 文本 + 往来名解析
  incomeExpend?: 'income' | 'expend'; // 其他收支单
  detailStoresFields?: 'out_enter' | 'single'; // 明细仓库字段（调拨用 stores_out/stores_enter）
}

/** 汇总表打印配置 */
export interface SummaryPrintConfig {
  key: string;
  title: string;
  mode: 'summary';
  /** 允许作为检索条件的列（白名单，防注入） */
  searchCols: string[];
}

export type PrintConfig = DocPrintConfig | SummaryPrintConfig;

export const PRINT_TYPES: Record<string, PrintConfig> = {
  // ===== 单据打印（原 switch 数字分支 1-6） =====
  '1': {
    key: '1', title: '采购订单', mode: 'document',
    header: 'kuyou_goods_purchase_order', detail: 'kuyou_goods_purchase_order_info',
    linkField: 'purchase_code', goodsBy: 'code', numberField: 'number', moneyField: 'money_tax_price',
    party: { table: 'kuyou_suppliers', by: 'code', key: 'supplyer_code', headerField: 'supplyer_code', outField: 'suppliers' },
  },
  '2': {
    key: '2', title: '采购单', mode: 'document',
    header: 'kuyou_goods_purchase', detail: 'kuyou_goods_purchase_info',
    linkField: 'purchase_code', goodsBy: 'code', numberField: 'number', moneyField: 'money_tax_price',
    party: { table: 'kuyou_suppliers', by: 'code', key: 'supplyer_code', headerField: 'supplyer_code', outField: 'suppliers' },
  },
  '3': {
    key: '3', title: '采购退货单', mode: 'document',
    header: 'kuyou_goods_exchange', detail: 'kuyou_goods_exchange_info',
    linkField: 'purchase_code', goodsBy: 'code', numberField: 'retreat_number', moneyField: 'money_tax_price',
    headerMoneyOverride: true,
    party: { table: 'kuyou_suppliers', by: 'code', key: 'supplyer_code', headerField: 'supplyer_code', outField: 'suppliers' },
  },
  '4': {
    key: '4', title: '销售订单', mode: 'document',
    header: 'kuyou_goods_sales_order', detail: 'kuyou_goods_sales_order_info',
    linkField: 'purchase_code', goodsBy: 'code', numberField: 'number', moneyField: 'money_tax_price',
    party: { table: 'kuyou_customers', by: 'id', key: 'id', headerField: 'customers_id', outField: 'customers' },
    staff: true,
  },
  '5': {
    key: '5', title: '销售单', mode: 'document',
    header: 'kuyou_goods_sales', detail: 'kuyou_goods_sales_info',
    linkField: 'purchase_code', goodsBy: 'code', numberField: 'number', moneyField: 'money_tax_price',
    party: { table: 'kuyou_customers', by: 'id', key: 'id', headerField: 'customers_id', outField: 'customers' },
    staff: true,
  },
  '6': {
    key: '6', title: '销售退货单', mode: 'document',
    header: 'kuyou_goods_sales_exchange', detail: 'kuyou_goods_sales_exchange_info',
    linkField: 'purchase_code', goodsBy: 'code', numberField: 'retreat_number', moneyField: 'money_tax_price',
    party: { table: 'kuyou_customers', by: 'id', key: 'id', headerField: 'customers_id', outField: 'customers' },
    staff: true,
  },

  // ===== 单据打印（原 switch 命名分支） =====
  dbd: {
    key: 'dbd', title: '调拨单', mode: 'document',
    header: 'kuyou_allocation', detail: 'kuyou_allocation_info',
    linkField: 'id', detailLinkField: 'allocation_id', goodsBy: 'id', numberField: 'number',
    detailOutField: 'info_list', detailStoresFields: 'out_enter',
  },
  cbtzd: {
    key: 'cbtzd', title: '成本调整单', mode: 'document',
    header: 'kuyou_adjustment', detail: 'kuyou_adjustment_info',
    linkField: 'purchase_code', goodsBy: 'id', numberField: 'number', moneyField: 'money',
  },
  qtrkd: {
    key: 'qtrkd', title: '其他入库单', mode: 'document',
    header: 'kuyou_warehousing', detail: 'kuyou_warehousing_info',
    linkField: 'purchase_code', goodsBy: 'id', numberField: 'number', moneyField: 'price',
    party: { table: 'kuyou_suppliers', by: 'id', key: 'id', headerField: 'suppliers_id', outField: 'suppliers' },
  },
  qtckd: {
    key: 'qtckd', title: '其他出库单', mode: 'document',
    header: 'kuyou_warehouse', detail: 'kuyou_warehouse_info',
    linkField: 'purchase_code', goodsBy: 'id', numberField: 'number', moneyField: 'price',
    party: { table: 'kuyou_customers', by: 'id', key: 'id', headerField: 'customers_id', outField: 'customers' },
  },
  zzd: {
    key: 'zzd', title: '组装单', mode: 'document',
    header: 'kuyou_assemble', detail: 'kuyou_assemble_info',
    linkField: 'purchase_code', goodsBy: 'id', numberField: 'number', moneyField: 'cost_money', moneyTypeFilter: 2,
  },
  cxd: {
    key: 'cxd', title: '拆分单', mode: 'document',
    header: 'kuyou_split', detail: 'kuyou_split_info',
    linkField: 'purchase_code', goodsBy: 'id', numberField: 'number', moneyField: 'cost_money', moneyTypeFilter: 2,
  },
  fkd: {
    key: 'fkd', title: '付款单', mode: 'document',
    header: 'kuyou_payment',
    linkField: 'id', goodsBy: 'id', numberField: 'number', accounts: true,
    party: { table: 'kuyou_suppliers', by: 'id', key: 'id', headerField: 'customers_id', outField: 'suppliers' },
  },
  skd: {
    key: 'skd', title: '收款单', mode: 'document',
    header: 'kuyou_collection',
    linkField: 'id', goodsBy: 'id', numberField: 'number', accounts: true,
    party: { table: 'kuyou_customers', by: 'id', key: 'id', headerField: 'customers_id', outField: 'customers' },
  },
  hxd: {
    key: 'hxd', title: '核销单', mode: 'document',
    header: 'kuyou_writeoff',
    linkField: 'id', goodsBy: 'id', numberField: 'number', writeoff: true,
  },
  qtsrd: {
    key: 'qtsrd', title: '其他收入单', mode: 'document',
    header: 'kuyou_income', detail: 'kuyou_income_info',
    linkField: 'purchase_code', goodsBy: 'id', numberField: 'number', moneyField: 'money', incomeExpend: 'income',
    party: { table: 'kuyou_customers', by: 'id', key: 'id', headerField: 'customers_id', outField: 'customers' },
  },
  qtzcd: {
    key: 'qtzcd', title: '其他支出单', mode: 'document',
    header: 'kuyou_expenditure', detail: 'kuyou_expenditure_info',
    linkField: 'purchase_code', goodsBy: 'id', numberField: 'number', moneyField: 'money', incomeExpend: 'expend',
    party: { table: 'kuyou_suppliers', by: 'id', key: 'id', headerField: 'suppliers_id', outField: 'suppliers' },
  },

  // ===== 汇总表打印（报表类） =====
  cgmx: {
    key: 'cgmx', title: '采购明细表', mode: 'summary',
    searchCols: ['purchase_code', 'goods_code', 'supplyer_code', 'goods_attr', 'purchase_time'],
  },
  cgddgz: {
    key: 'cgddgz', title: '采购订单跟踪表', mode: 'summary',
    searchCols: ['goods_code', 'supplyer_code', 'purchase_time', 'delivery_time'],
  },
  cghzb_sp: {
    key: 'cghzb_sp', title: '采购汇总表(按商品)', mode: 'summary',
    searchCols: ['goods_code', 'stores_id', 'supplyer_code', 'purchase_time'],
  },
  cghzb_gys: {
    key: 'cghzb_gys', title: '采购汇总表(按供应商)', mode: 'summary',
    searchCols: ['supplyer_code', 'goods_code', 'stores_id', 'purchase_time'],
  },
  cgfk: {
    key: 'cgfk', title: '采购付款流水', mode: 'summary',
    searchCols: ['bill_code', 'suppliers_code', 'bill_time'],
  },
  xsddgz: {
    key: 'xsddgz', title: '销售订单跟踪表', mode: 'summary',
    searchCols: ['goods_code', 'customers_id', 'purchase_time', 'delivery_time'],
  },
};

/** 取所有打印类型元信息（供前端渲染选择器） */
export function printTypeList() {
  return Object.values(PRINT_TYPES).map((c) => ({
    key: c.key,
    title: c.title,
    mode: c.mode,
  }));
}
