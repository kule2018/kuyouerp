/**
 * 通用单据引擎配置
 *
 * 原 kuyou 全部业务单据高度同构，但明细表关联主键存在三种模式，本配置逐一显式声明：
 *  1) 业务单号关联：明细与主表同名列 `purchase_code`（购销 / 出入库 / 组装拆卸 / 收付款）
 *  2) 主键外键关联：明细列 `<xxx>_id` = 主表 `id`（调拨 / 生产计划 / 生产 / 领料 / 补料 …）
 *  3) 双仓调拨：调拨单明细同时有调出仓 stores_out 与调入仓 stores_enter
 *
 * 审核位：购销存单据 `check_status`（另有 pay_status 表示付款状态），
 *         资金 / 生产单据 `examine_status`；无审核流程的单据 statusField 置空。
 * 过账联动：仓库类单据审核后按明细行增减 kuyou_goods_stock 与 kuyou_goods.inventory。
 */

/** 库存联动配置：单据审核后按明细行增减库存 */
export interface StockLink {
  /** 明细表商品列（部分单据为 goods_code，另一些只有 goods_id） */
  goodsField: string;
  /** 明细表仓库列 */
  storesField: string;
  /** 明细表数量列 */
  qtyField: string;
  /** in=审核入库(+) / out=审核出库(-) */
  direction: 'in' | 'out';
}

/** 调拨联动配置：调出仓减库存、调入仓加库存 */
export interface TransferLink {
  goodsField: string;
  /** 调出仓列 */
  fromField: string;
  /** 调入仓列 */
  toField: string;
  qtyField: string;
}

/** 主表明细表关联（缺省为按业务单号 codeField 关联） */
export interface DetailLink {
  /** 明细表上的关联列 */
  detailField: string;
  /** 主表上的关联列 */
  headerField: string;
}

export interface DocumentConfig {
  /** 主表名 */
  header: string;
  /** 明细表名（无明细的单据如收款/付款/转账为空） */
  detail?: string;
  /** 业务单号列（主表；明细表同名则无需额外链接配置） */
  codeField: string;
  /** 审核状态列；空串表示该单据无审核流程 */
  statusField: string;
  /** 自动生成单据编号的前缀 */
  prefix: string;
  /** 主表明细表关联方式（缺省按 codeField 关联） */
  link?: DetailLink;
  /** 库存联动 */
  stock?: StockLink;
  /** 调拨联动 */
  transfer?: TransferLink;
  /** 页面标题（中文，与截图一致） */
  title: string;
  /** 业务分组（前端菜单归类） */
  group: string;
  /**
   * 固定过滤条件：同一张物理表按业务标识拆成多个独立页面时使用。
   * 典型场景：零售单与销货单共用 kuyou_goods_sales，靠 order_type=2 区分零售。
   * 该条件会同时作用于列表查询与新增写入（隐藏必带字段）。
   */
  fixedFilter?: Record<string, string | number>;
  /**
   * 审核财务档案：声明该单据审核 / 反审核时需要联动的资金动作。
   * 原系统每类单据的 examine 方法除翻状态位外，还各自维护往来欠款、
   * 账户余额、账户流水、收付款流水、开票登记与核销状态，此处逐一对应。
   * 取值见 document.finance.ts 的 FinanceProfile。
   */
  finance?: FinanceProfile;
}

/**
 * 审核财务档案类型（与源系统各控制器 examine 的资金动作一一对应）：
 *  - purchase       购货单：供应商应付款+、付款账户支出、付款流水、采购开票登记
 *  - purchaseRetreat购货退货单：供应商应付款-、退款账户收入、付款流水(退货)
 *  - sales          销货单：客户应收款+、收款账户收入、销售流水、销售开票登记
 *  - salesRetreat   销货退货单：客户应收款-、退款账户支出、销售流水(退货)
 *  - collection     收款单：收款子表账户收入、核销源单、客户对账明细
 *  - payment        付款单：付款子表账户支出、核销源单、供应商对账明细
 *  - income         其他收入单：账户收入、关联采购销售费用、应收明细
 *  - expenditure    其他支出单：账户支出、关联采购销售费用
 *  - transfer       转账单：转出账户支出、转入账户收入（两条账户流水）
 *  - writeoff       核销单：源单收付状态推进、核销来源流水
 */
export type FinanceProfile =
  | 'purchase'
  | 'purchaseRetreat'
  | 'sales'
  | 'salesRetreat'
  | 'collection'
  | 'payment'
  | 'income'
  | 'expenditure'
  | 'transfer'
  | 'writeoff';

/** 单据注册表：key = 主表名，与动态路由 :table 一致 */
export const DOCUMENT_CONFIGS: Record<string, DocumentConfig> = {
  /* ---------------- 采购业务 ---------------- */
  kuyou_goods_purchase_order: {
    header: 'kuyou_goods_purchase_order',
    detail: 'kuyou_goods_purchase_order_info',
    codeField: 'purchase_code',
    statusField: 'check_status',
    prefix: 'CGDD',
    title: '购货订单',
    group: '采购管理',
  },
  kuyou_goods_purchase: {
    header: 'kuyou_goods_purchase',
    detail: 'kuyou_goods_purchase_info',
    codeField: 'purchase_code',
    statusField: 'check_status',
    prefix: 'CG',
    stock: { goodsField: 'goods_code', storesField: 'stores_id', qtyField: 'number', direction: 'in' },
    finance: 'purchase',
    title: '购货单',
    group: '采购管理',
  },
  kuyou_goods_exchange: {
    header: 'kuyou_goods_exchange',
    detail: 'kuyou_goods_exchange_info',
    codeField: 'purchase_code',
    statusField: 'check_status',
    prefix: 'CGTH',
    stock: { goodsField: 'goods_code', storesField: 'stores_id', qtyField: 'number', direction: 'out' },
    finance: 'purchaseRetreat',
    title: '购货退货单',
    group: '采购管理',
  },
  /* ---------------- 销售业务 ---------------- */
  kuyou_goods_sales_order: {
    header: 'kuyou_goods_sales_order',
    detail: 'kuyou_goods_sales_order_info',
    codeField: 'purchase_code',
    statusField: 'check_status',
    prefix: 'XHDD',
    title: '销货订单',
    group: '销售管理',
  },
  kuyou_goods_sales: {
    header: 'kuyou_goods_sales',
    detail: 'kuyou_goods_sales_info',
    codeField: 'purchase_code',
    statusField: 'check_status',
    prefix: 'XH',
    stock: { goodsField: 'goods_code', storesField: 'stores_id', qtyField: 'number', direction: 'out' },
    finance: 'sales',
    title: '销货单',
    group: '销售管理',
  },
  kuyou_goods_sales_exchange: {
    header: 'kuyou_goods_sales_exchange',
    detail: 'kuyou_goods_sales_exchange_info',
    codeField: 'purchase_code',
    statusField: 'check_status',
    prefix: 'XHTH',
    stock: { goodsField: 'goods_code', storesField: 'stores_id', qtyField: 'number', direction: 'in' },
    finance: 'salesRetreat',
    title: '销货退货单',
    group: '销售管理',
  },
  /* 零售业务：与 sales 共用物理表，靠 order_type=2 区分 */
  kuyou_retail_sales: {
    header: 'kuyou_goods_sales',
    detail: 'kuyou_goods_sales_info',
    codeField: 'purchase_code',
    statusField: 'check_status',
    prefix: 'LS',
    stock: { goodsField: 'goods_code', storesField: 'stores_id', qtyField: 'number', direction: 'out' },
    fixedFilter: { order_type: 2 },
    finance: 'sales',
    title: '零售单',
    group: '销售管理',
  },
  kuyou_retail_sales_exchange: {
    header: 'kuyou_goods_sales_exchange',
    detail: 'kuyou_goods_sales_exchange_info',
    codeField: 'purchase_code',
    statusField: 'check_status',
    prefix: 'LSTH',
    stock: { goodsField: 'goods_code', storesField: 'stores_id', qtyField: 'number', direction: 'in' },
    fixedFilter: { order_type: 2 },
    finance: 'salesRetreat',
    title: '零售退货单',
    group: '销售管理',
  },
  /* ---------------- 仓库业务 ---------------- */
  kuyou_warehousing: {
    header: 'kuyou_warehousing',
    detail: 'kuyou_warehousing_info',
    codeField: 'purchase_code',
    statusField: 'examine_status',
    prefix: 'QTRK',
    stock: { goodsField: 'goods_id', storesField: 'stores_id', qtyField: 'number', direction: 'in' },
    title: '其他入库单',
    group: '库存管理',
  },
  kuyou_warehouse: {
    header: 'kuyou_warehouse',
    detail: 'kuyou_warehouse_info',
    codeField: 'purchase_code',
    statusField: 'examine_status',
    prefix: 'QTCK',
    stock: { goodsField: 'goods_id', storesField: 'stores_id', qtyField: 'number', direction: 'out' },
    title: '其他出库单',
    group: '库存管理',
  },
  kuyou_allocation: {
    header: 'kuyou_allocation',
    detail: 'kuyou_allocation_info',
    codeField: 'purchase_code',
    statusField: 'examine_status',
    prefix: 'DB',
    link: { detailField: 'allocation_id', headerField: 'id' },
    transfer: { goodsField: 'goods_id', fromField: 'stores_out', toField: 'stores_enter', qtyField: 'number' },
    title: '调拨单',
    group: '库存管理',
  },
  kuyou_adjustment: {
    header: 'kuyou_adjustment',
    detail: 'kuyou_adjustment_info',
    codeField: 'purchase_code',
    statusField: '',
    prefix: 'CBTZ',
    title: '成本调整单',
    group: '库存管理',
  },
  kuyou_inventory: {
    header: 'kuyou_inventory',
    detail: 'kuyou_inventory_info',
    codeField: 'purchase_code',
    statusField: '',
    prefix: 'PD',
    title: '盘点单',
    group: '库存管理',
  },
  kuyou_inventory_serial: {
    header: 'kuyou_inventory_serial',
    detail: 'kuyou_inventory_serial_info',
    codeField: 'purchase_code',
    statusField: '',
    prefix: 'XLPD',
    title: '序列号盘点单',
    group: '库存管理',
  },
  kuyou_assemble: {
    header: 'kuyou_assemble',
    detail: 'kuyou_assemble_info',
    codeField: 'purchase_code',
    statusField: 'examine_status',
    prefix: 'ZZ',
    title: '组装单',
    group: '库存管理',
  },
  kuyou_split: {
    header: 'kuyou_split',
    detail: 'kuyou_split_info',
    codeField: 'purchase_code',
    statusField: 'examine_status',
    prefix: 'CX',
    title: '拆卸单',
    group: '库存管理',
  },
  /* ---------------- 资金业务 ---------------- */
  kuyou_collection: {
    header: 'kuyou_collection',
    codeField: 'purchase_code',
    statusField: 'examine_status',
    prefix: 'SK',
    finance: 'collection',
    title: '收款单',
    group: '财务管理',
  },
  kuyou_payment: {
    header: 'kuyou_payment',
    codeField: 'purchase_code',
    statusField: 'examine_status',
    prefix: 'FK',
    finance: 'payment',
    title: '付款单',
    group: '财务管理',
  },
  kuyou_accounts_transfer: {
    header: 'kuyou_accounts_transfer',
    detail: 'kuyou_accounts_transfer_info',
    codeField: 'purchase_code',
    statusField: 'examine_status',
    prefix: 'ZZZZ',
    finance: 'transfer',
    title: '资金转账单',
    group: '财务管理',
  },
  kuyou_income: {
    header: 'kuyou_income',
    detail: 'kuyou_income_info',
    codeField: 'purchase_code',
    statusField: 'examine_status',
    prefix: 'QTSR',
    finance: 'income',
    title: '其他收入单',
    group: '财务管理',
  },
  kuyou_expenditure: {
    header: 'kuyou_expenditure',
    detail: 'kuyou_expenditure_info',
    codeField: 'purchase_code',
    statusField: 'examine_status',
    prefix: 'QTZC',
    finance: 'expenditure',
    title: '其他支出单',
    group: '财务管理',
  },
  kuyou_cost: {
    header: 'kuyou_cost',
    codeField: 'purchase_code',
    statusField: 'examine_status',
    prefix: 'FY',
    title: '费用单',
    group: '财务管理',
  },
  kuyou_writeoff: {
    header: 'kuyou_writeoff',
    detail: 'kuyou_writeoff_info',
    codeField: 'purchase_code',
    statusField: 'examine_status',
    prefix: 'HX',
    link: { detailField: 'purchase_code', headerField: 'purchase_code' },
    finance: 'writeoff',
    title: '核销单',
    group: '财务管理',
  },
  kuyou_user_order: {
    header: 'kuyou_user_order',
    detail: 'kuyou_user_orderinfo',
    codeField: 'order_num',
    statusField: '',
    prefix: 'DHD',
    link: { detailField: 'order_id', headerField: 'id' },
    title: '订货单',
    group: '销售管理',
  },
  /* ---------------- 生产业务 ---------------- */
  kuyou_plan: {
    header: 'kuyou_plan',
    detail: 'kuyou_plan_info',
    codeField: 'purchase_code',
    statusField: 'examine_status',
    prefix: 'SCJH',
    link: { detailField: 'plan_id', headerField: 'id' },
    title: '生产计划单',
    group: '生产管理',
  },
  kuyou_production: {
    header: 'kuyou_production',
    detail: 'kuyou_production_info',
    codeField: 'purchase_code',
    statusField: 'examine_status',
    prefix: 'SCD',
    link: { detailField: 'production_id', headerField: 'id' },
    title: '生产单',
    group: '生产管理',
  },
  kuyou_picking: {
    header: 'kuyou_picking',
    detail: 'kuyou_picking_info',
    codeField: 'purchase_code',
    statusField: 'examine_status',
    prefix: 'LLD',
    link: { detailField: 'production_id', headerField: 'id' },
    title: '领料单',
    group: '生产管理',
  },
  kuyou_material: {
    header: 'kuyou_material',
    detail: 'kuyou_material_info',
    codeField: 'purchase_code',
    statusField: 'examine_status',
    prefix: 'BLD',
    link: { detailField: 'production_id', headerField: 'id' },
    title: '补料单',
    group: '生产管理',
  },
  kuyou_outsourcing: {
    header: 'kuyou_outsourcing',
    detail: 'kuyou_outsourcing_info',
    codeField: 'purchase_code',
    statusField: 'examine_status',
    prefix: 'WWJG',
    link: { detailField: 'production_id', headerField: 'id' },
    title: '委外加工单',
    group: '生产管理',
  },
  kuyou_acceptance: {
    header: 'kuyou_acceptance',
    detail: 'kuyou_acceptance_info',
    codeField: 'purchase_code',
    statusField: 'examine_status',
    prefix: 'YSD',
    link: { detailField: 'production_id', headerField: 'id' },
    title: '验收单',
    group: '生产管理',
  },
};

/** 取主表明细关联条件（缺省按业务单号关联） */
export function detailLinkOf(c: DocumentConfig): DetailLink {
  return c.link || { detailField: c.codeField, headerField: c.codeField };
}
