/**
 * 通用报表引擎配置
 *
 * 设计原则（安全 + 可扩展）：
 *  - 每个报表声明：数据来源单表 from、显示列 select（别名 -> SQL 片段）、可筛字段 filters
 *  - select 片段由本文件固化的开发者 SQL 提供，不接收任何用户输入；
 *    用户输入只通过 filters 以参数化形式进入 WHERE，杜绝注入
 *  - 跨表名称（供应商/客户/商品/仓库/账户）用标量子查询取，避免 JOIN 到不存在列
 *
 * 表别名统一为 t，下标引写法均为 t.`列名`
 */

export interface ReportFilter {
  /** 参数名（前端表单字段） */
  name: string;
  /** 中文标签 */
  label: string;
  /** 表单控件类型 */
  type: 'text' | 'number' | 'date' | 'select';
  /** 数据库列名（缺省同 name） */
  field?: string;
  /** 比较运算符，缺省 = */
  op?: '=' | 'LIKE' | '>=' | '<=';
  /** 固定枚举选项 */
  enum?: { value: string; label: string }[];
  /** 远端字典（前端渲染成下拉选择器） */
  ref?: { table: string; labelField: string };
}

export interface ReportDef {
  key: string;
  title: string;
  group: string;
  /** 数据来源表（单表） */
  from: string;
  /** 显示列：前端表头别名 -> SQL 片段 */
  select: Record<string, string>;
  /** 查询条件定义 */
  filters: ReportFilter[];
  /** 固定过滤条件（AND 片段，全部走常量） */
  fixedWhere?: string;
  /** 分组（汇总类报表用） */
  groupBy?: string;
  /** 默认排序 */
  orderBy?: string;
}

/** 常用名称解析子查询（避免 JOIN） */
const SUPPLIER_NAME = `(SELECT s.supplyer_name FROM kuyou_suppliers s WHERE s.supplyer_code = t.supplyer_code LIMIT 1)`;
const CUSTOMER_NAME = `(SELECT c.customer_name FROM kuyou_customers c WHERE c.id = t.customers_id LIMIT 1)`;
const GOODS_NAME = `(SELECT g.goods_name FROM kuyou_goods g WHERE g.goods_code = t.goods_code LIMIT 1)`;
const STORE_NAME = `(SELECT st.name FROM kuyou_stores st WHERE st.id = t.stores_id LIMIT 1)`;
const ACCOUNT_NAME = `(SELECT a.account_name FROM kuyou_accounts a WHERE a.id = t.accounts_id LIMIT 1)`;

/** 通用日期区间筛选（时间戳列用秒级比较） */
const timeRange = (field = 'purchase_time'): ReportFilter[] => [
  { name: 'begin_time', label: '开始日期', type: 'date', field, op: '>=' },
  { name: 'end_time', label: '结束日期', type: 'date', field, op: '<=' },
];

export const REPORTS: ReportDef[] = [
  /* ---------------- 采购报表 ---------------- */
  {
    key: 'purchase_detail',
    title: '采购明细表',
    group: '采购报表',
    from: 'kuyou_goods_purchase_summary',
    select: {
      单据日期: 't.`purchase_time`',
      单据编号: 't.`purchase_code`',
      供应商编码: 't.`supplyer_code`',
      供应商名称: SUPPLIER_NAME,
      商品编码: 't.`goods_code`',
      商品名称: GOODS_NAME,
      规格型号: 't.`goods_attr`',
      单位: 't.`goods_unit`',
      仓库: STORE_NAME,
      数量: 't.`number`',
      单价: 't.`unit_price`',
      金额: 't.`all_money`',
      已付金额: 't.`pay_money`',
      备注: 't.`remark`',
    },
    filters: [...timeRange(), { name: 'purchase_code', label: '单据编号', type: 'text', op: 'LIKE' }, { name: 'supplyer_code', label: '供应商', type: 'select', ref: { table: 'kuyou_suppliers', labelField: 'supplyer_name' } }],
    orderBy: 't.`id` DESC',
  },
  {
    key: 'purchase_order_trace',
    title: '采购订单跟踪表',
    group: '采购报表',
    from: 'kuyou_goods_purchase_order',
    select: {
      单据日期: 't.`purchase_time`',
      单据编号: 't.`purchase_code`',
      供应商编码: 't.`supplyer_code`',
      供应商名称: SUPPLIER_NAME,
      订单数量: 't.`number`',
      已入库数量: 't.`store_number`',
      订单金额: 't.`all_money`',
      审核状态: 't.`check_status`',
      关闭状态: 't.`status`',
      备注: 't.`note`',
    },
    filters: [...timeRange(), { name: 'purchase_code', label: '单据编号', type: 'text', op: 'LIKE' }],
    orderBy: 't.`id` DESC',
  },
  {
    key: 'purchase_summary_goods',
    title: '采购汇总表(按商品)',
    group: '采购报表',
    from: 'kuyou_goods_purchase_summary',
    select: {
      商品编码: 't.`goods_code`',
      商品名称: GOODS_NAME,
      规格型号: 't.`goods_attr`',
      单位: 't.`goods_unit`',
      合计数量: 'SUM(t.`number`)',
      合计金额: 'SUM(t.`all_money`)',
      税额合计: 'SUM(t.`tax_money`)',
      单据数: 'COUNT(DISTINCT t.`purchase_code`)',
    },
    filters: [...timeRange(), { name: 'goods_code', label: '商品编码', type: 'text', op: 'LIKE' }],
    groupBy: 't.`goods_code`, t.`goods_attr`',
    orderBy: '`合计金额` DESC',
  },
  {
    key: 'purchase_summary_supplier',
    title: '采购汇总表(按供应商)',
    group: '采购报表',
    from: 'kuyou_goods_purchase_summary',
    select: {
      供应商编码: 't.`supplyer_code`',
      供应商名称: SUPPLIER_NAME,
      单据数: 'COUNT(DISTINCT t.`purchase_code`)',
      合计数量: 'SUM(t.`number`)',
      合计金额: 'SUM(t.`all_money`)',
      已付金额: 'SUM(t.`pay_money`)',
      欠款金额: 'SUM(t.`all_money`) - SUM(t.`pay_money`)',
    },
    filters: [...timeRange()],
    groupBy: 't.`supplyer_code`',
    orderBy: '`合计金额` DESC',
  },
  {
    key: 'purchase_payment_list',
    title: '采购付款一览表',
    group: '采购报表',
    from: 'kuyou_payment_account',
    select: {
      单据日期: 't.`purchase_time`',
      付款单号: 't.`purchase_code`',
      源单编号: 't.`purchase_code`',
      结算账户: ACCOUNT_NAME,
      付款金额: 't.`money`',
      结算方式: 't.`settlementtype`',
      备注: 't.`remark`',
    },
    filters: [...timeRange()],
    orderBy: 't.`id` DESC',
  },
  /* ---------------- 销售报表 ---------------- */
  {
    key: 'sales_detail',
    title: '商品销售明细',
    group: '销售报表',
    from: 'kuyou_goods_sales_summary',
    select: {
      单据日期: 't.`purchase_time`',
      单据编号: 't.`purchase_code`',
      客户编码: 't.`customers_id`',
      客户名称: CUSTOMER_NAME,
      商品编码: 't.`goods_code`',
      商品名称: GOODS_NAME,
      仓库: STORE_NAME,
      数量: 't.`number`',
      单价: 't.`unit_price`',
      金额: 't.`all_money`',
      已收金额: 't.`pay_money`',
    },
    filters: [...timeRange(), { name: 'purchase_code', label: '单据编号', type: 'text', op: 'LIKE' }],
    orderBy: 't.`id` DESC',
  },
  {
    key: 'sales_order_trace',
    title: '销售订单跟踪表',
    group: '销售报表',
    from: 'kuyou_goods_sales_order',
    select: {
      单据日期: 't.`purchase_time`',
      单据编号: 't.`purchase_code`',
      客户名称: CUSTOMER_NAME,
      订单数量: 't.`number`',
      已出库数量: 't.`store_number`',
      订单金额: 't.`all_money`',
      审核状态: 't.`check_status`',
      备注: 't.`note`',
    },
    filters: [...timeRange(), { name: 'purchase_code', label: '单据编号', type: 'text', op: 'LIKE' }],
    orderBy: 't.`id` DESC',
  },
  {
    key: 'sales_summary_goods',
    title: '销售汇总表(按商品)',
    group: '销售报表',
    from: 'kuyou_goods_sales_summary',
    select: {
      商品编码: 't.`goods_code`',
      商品名称: GOODS_NAME,
      规格型号: 't.`goods_attr`',
      单位: 't.`goods_unit`',
      合计数量: 'SUM(t.`number`)',
      合计金额: 'SUM(t.`all_money`)',
      成本合计: 'SUM(t.`cost_price`)',
    },
    filters: [...timeRange()],
    groupBy: 't.`goods_code`, t.`goods_attr`',
    orderBy: '`合计金额` DESC',
  },
  {
    key: 'sales_summary_customer',
    title: '销售汇总表(按客户)',
    group: '销售报表',
    from: 'kuyou_goods_sales_summary',
    select: {
      客户编码: 't.`customers_id`',
      客户名称: CUSTOMER_NAME,
      单据数: 'COUNT(DISTINCT t.`purchase_code`)',
      合计数量: 'SUM(t.`number`)',
      合计金额: 'SUM(t.`all_money`)',
      已收金额: 'SUM(t.`pay_money`)',
    },
    filters: [...timeRange()],
    groupBy: 't.`customers_id`',
    orderBy: '`合计金额` DESC',
  },
  {
    key: 'sales_summary_user',
    title: '销售汇总表(按销售员)',
    group: '销售报表',
    from: 'kuyou_goods_sales_summary',
    select: {
      销售员: 't.`sale_user`',
      单据数: 'COUNT(DISTINCT t.`purchase_code`)',
      合计数量: 'SUM(t.`number`)',
      合计金额: 'SUM(t.`all_money`)',
      客户数: 'COUNT(DISTINCT t.`customers_id`)',
    },
    filters: [...timeRange()],
    groupBy: 't.`sale_user`',
    orderBy: '`合计金额` DESC',
  },
  {
    key: 'sales_profit',
    title: '销售利润表',
    group: '销售报表',
    from: 'kuyou_goods_sales_profit',
    select: {
      单据日期: 't.`purchase_time`',
      单据编号: 't.`purchase_code`',
      客户名称: CUSTOMER_NAME,
      销售金额: 't.`all_money`',
      销售成本: 't.`sales_cost`',
      毛利: 't.`all_money` - t.`sales_cost`',
      费用: 't.`purchase_money`',
      实收金额: 't.`pay_money`',
    },
    filters: [...timeRange()],
    orderBy: 't.`id` DESC',
  },
  {
    key: 'sales_rank',
    title: '销售排行表',
    group: '销售报表',
    from: 'kuyou_goods_sales_summary',
    select: {
      商品编码: 't.`goods_code`',
      商品名称: GOODS_NAME,
      销量: 'SUM(t.`number`)',
      销售额: 'SUM(t.`all_money`)',
      毛利: 'SUM(t.`all_money`) - SUM(t.`cost_price`)',
    },
    filters: [...timeRange()],
    groupBy: 't.`goods_code`',
    orderBy: '`销售额` DESC',
  },
  {
    key: 'sales_collection_list',
    title: '销售收款一览表',
    group: '销售报表',
    from: 'kuyou_collection_account',
    select: {
      单据日期: 't.`purchase_time`',
      收款单号: 't.`purchase_code`',
      结算账户: ACCOUNT_NAME,
      收款金额: 't.`money`',
      结算方式: 't.`settlementtype`',
      备注: 't.`remark`',
    },
    filters: [...timeRange()],
    orderBy: 't.`id` DESC',
  },
  /* ---------------- 库存报表 ---------------- */
  {
    key: 'stock_balance',
    title: '商品库存余额表',
    group: '库存报表',
    from: 'kuyou_goods_stock',
    select: {
      商品编码: 't.`goods_code`',
      商品名称: GOODS_NAME,
      规格属性: 't.`attribute_id`',
      仓库: STORE_NAME,
      库存数量: 't.`stock`',
      单位成本: 't.`unit_cost`',
      库存金额: 't.`cost_money`',
      预警下限: 't.`min_stock`',
    },
    filters: [
      { name: 'goods_code', label: '商品编码', type: 'text', op: 'LIKE' },
      { name: 'stores_id', label: '仓库', type: 'select', ref: { table: 'kuyou_stores', labelField: 'name' } },
    ],
    fixedWhere: 't.`deletetime` IS NULL',
    orderBy: 't.`goods_code` ASC',
  },
  {
    key: 'stock_warning',
    title: '库存预警表',
    group: '库存报表',
    from: 'kuyou_goods_stock',
    select: {
      商品编码: 't.`goods_code`',
      商品名称: GOODS_NAME,
      仓库: STORE_NAME,
      当前库存: 't.`stock`',
      预警下限: 't.`min_stock`',
      预警上限: 't.`max_stock`',
      缺货数量: 't.`min_stock` - t.`stock`',
    },
    filters: [
      { name: 'goods_code', label: '商品编码', type: 'text', op: 'LIKE' },
      { name: 'stores_id', label: '仓库', type: 'select', ref: { table: 'kuyou_stores', labelField: 'name' } },
    ],
    fixedWhere: 't.`deletetime` IS NULL AND t.`stock` <= t.`min_stock`',
    orderBy: '`缺货数量` DESC',
  },
  {
    key: 'goods_io_detail',
    title: '商品收发存明细表',
    group: '库存报表',
    from: 'kuyou_goods_log',
    select: {
      单据日期: 't.`purchase_time`',
      单据编号: 't.`purchase_code`',
      业务类型: 't.`business_type`',
      商品编码: 't.`goods_code`',
      商品名称: GOODS_NAME,
      仓库: STORE_NAME,
      入库数量: 't.`enter_number`',
      出库数量: 't.`out_number`',
      结存数量: 't.`balance_basics`',
      备注: 't.`remark`',
    },
    filters: [...timeRange(), { name: 'goods_code', label: '商品编码', type: 'text', op: 'LIKE' }],
    orderBy: 't.`id` DESC',
  },
  {
    key: 'goods_io_summary',
    title: '商品收发存汇总表',
    group: '库存报表',
    from: 'kuyou_goods_log',
    select: {
      商品编码: 't.`goods_code`',
      商品名称: GOODS_NAME,
      仓库: STORE_NAME,
      入库合计: 'SUM(t.`enter_number`)',
      出库合计: 'SUM(t.`out_number`)',
      结存数量: 'SUM(t.`enter_number`) - SUM(t.`out_number`)',
    },
    filters: [...timeRange()],
    groupBy: 't.`goods_code`, t.`stores_id`',
    orderBy: '`入库合计` DESC',
  },
  {
    key: 'batch_trace',
    title: '批次跟踪表',
    group: '库存报表',
    from: 'kuyou_goods_batch',
    select: {
      商品编码: 't.`goods_code`',
      商品名称: GOODS_NAME,
      批次号: 't.`batch_name`',
      仓库: STORE_NAME,
      生产日期: 't.`manufacture`',
      有效期: 't.`validity`',
      保质期: 't.`guarantee`',
    },
    filters: [{ name: 'batch_name', label: '批次号', type: 'text', op: 'LIKE' }],
    orderBy: 't.`id` DESC',
  },
  {
    key: 'batch_validity',
    title: '批次保质期清单',
    group: '库存报表',
    from: 'kuyou_goods_batch',
    select: {
      商品编码: 't.`goods_code`',
      商品名称: GOODS_NAME,
      批次号: 't.`batch_name`',
      生产日期: 't.`manufacture`',
      有效期: 't.`validity`',
      '保质期(天)': 't.`guarantee`',
    },
    filters: [{ name: 'goods_code', label: '商品编码', type: 'text', op: 'LIKE' }],
    fixedWhere: 't.`validity` IS NOT NULL AND t.`validity` <> 0',
    orderBy: 't.`validity` ASC',
  },
  {
    key: 'serial_trace',
    title: '序列号跟踪表',
    group: '库存报表',
    from: 'kuyou_goods_serial',
    select: {
      序列号: 't.`serial`',
      商品编码: 't.`goods_code`',
      商品名称: GOODS_NAME,
      仓库: STORE_NAME,
      状态: 't.`status`',
      出入库单号: 't.`purchase_code`',
      备注: 't.`remark`',
    },
    filters: [{ name: 'serial', label: '序列号', type: 'text', op: 'LIKE' }, { name: 'goods_code', label: '商品编码', type: 'text', op: 'LIKE' }],
    orderBy: 't.`id` DESC',
  },
  /* ---------------- 资金报表 ---------------- */
  {
    key: 'receivable_detail',
    title: '应收账款明细表',
    group: '资金报表',
    from: 'kuyou_accounts_receivable',
    select: {
      单据日期: 't.`purchase_time`',
      单据编号: 't.`purchase_code`',
      客户名称: CUSTOMER_NAME,
      应收金额: 't.`receivable`',
      已收金额: 't.`amount`',
      欠款余额: 't.`receivable` - t.`amount`',
      业务类型: 't.`business_type`',
      备注: 't.`remark`',
    },
    filters: [...timeRange()],
    orderBy: '`欠款余额` DESC',
  },
  {
    key: 'payable_detail',
    title: '应付账款明细表',
    group: '资金报表',
    from: 'kuyou_accounts_copewith',
    select: {
      单据日期: 't.`purchase_time`',
      单据编号: 't.`purchase_code`',
      供应商名称: SUPPLIER_NAME.replace('t.supplyer_code', 't.suppliers_id'),
      应付金额: 't.`receivable`',
      已付金额: 't.`amount`',
      欠款余额: 't.`receivable` - t.`amount`',
      业务类型: 't.`business_type`',
      备注: 't.`remark`',
    },
    filters: [...timeRange()],
    orderBy: '`欠款余额` DESC',
  },
  {
    key: 'customer_statement',
    title: '客户对账单',
    group: '资金报表',
    from: 'kuyou_accounts_receivable',
    select: {
      客户编码: 't.`customers_id`',
      客户名称: CUSTOMER_NAME,
      应收合计: 'SUM(t.`receivable`)',
      已收合计: 'SUM(t.`amount`)',
      欠款余额: 'SUM(t.`receivable`) - SUM(t.`amount`)',
      单据数: 'COUNT(*)',
    },
    filters: [...timeRange()],
    groupBy: 't.`customers_id`',
    orderBy: '`欠款余额` DESC',
  },
  {
    key: 'supplier_statement',
    title: '供应商对账单',
    group: '资金报表',
    from: 'kuyou_accounts_copewith',
    select: {
      供应商编码: 't.`suppliers_id`',
      供应商名称: SUPPLIER_NAME.replace('t.supplyer_code', 't.suppliers_id'),
      应付合计: 'SUM(t.`receivable`)',
      已付合计: 'SUM(t.`amount`)',
      欠款余额: 'SUM(t.`receivable`) - SUM(t.`amount`)',
      单据数: 'COUNT(*)',
    },
    filters: [...timeRange()],
    groupBy: 't.`suppliers_id`',
    orderBy: '`欠款余额` DESC',
  },
  {
    key: 'cash_bank_report',
    title: '现金银行报表',
    group: '资金报表',
    from: 'kuyou_accounts',
    select: {
      账户编码: 't.`account_coding`',
      账户名称: 't.`account_name`',
      期初余额: 't.`start_account_balance`',
      当前余额: 't.`balance`',
      是否默认: 't.`is_default`',
      状态: 't.`status`',
    },
    filters: [{ name: 'account_name', label: '账户名称', type: 'text', op: 'LIKE' }],
    fixedWhere: 't.`deletetime` IS NULL',
    orderBy: 't.`account_coding` ASC',
  },
  {
    key: 'other_income_detail',
    title: '其他收支明细表',
    group: '资金报表',
    from: 'kuyou_income',
    select: {
      单据日期: 't.`purchase_time`',
      单据编号: 't.`purchase_code`',
      客户: CUSTOMER_NAME,
      收入金额: 't.`money`',
      已收金额: 't.`pay_money`',
      备注: 't.`remark`',
    },
    filters: [...timeRange()],
    orderBy: 't.`id` DESC',
  },
  {
    key: 'profit_report',
    title: '利润表',
    group: '资金报表',
    from: 'kuyou_goods_sales_profit',
    select: {
      业务月份: 'FROM_UNIXTIME(t.`purchase_time`, "%Y-%m")',
      销售收入: 'SUM(t.`all_money`)',
      销售成本: 'SUM(t.`sales_cost`)',
      毛利: 'SUM(t.`all_money`) - SUM(t.`sales_cost`)',
      费用: 'SUM(t.`preferential_money`)',
      净利: 'SUM(t.`all_money`) - SUM(t.`sales_cost`) - SUM(t.`preferential_money`)',
    },
    filters: [...timeRange()],
    groupBy: 'FROM_UNIXTIME(t.`purchase_time`, "%Y-%m")',
    orderBy: '`业务月份` DESC',
  },
  /* ---------------- 成本报表 ---------------- */
  {
    key: 'goods_cost_detail',
    title: '商品成本明细',
    group: '成本报表',
    from: 'kuyou_goods_stock',
    select: {
      商品编码: 't.`goods_code`',
      商品名称: GOODS_NAME,
      仓库: STORE_NAME,
      库存数量: 't.`stock`',
      单位成本: 't.`unit_cost`',
      库存金额: 't.`cost_money`',
    },
    filters: [
      { name: 'goods_code', label: '商品编码', type: 'text', op: 'LIKE' },
      { name: 'stores_id', label: '仓库', type: 'select', ref: { table: 'kuyou_stores', labelField: 'name' } },
    ],
    fixedWhere: 't.`deletetime` IS NULL',
    orderBy: 't.`goods_code` ASC',
  },
  {
    key: 'goods_shipped_cost',
    title: '发出商品成本',
    group: '成本报表',
    from: 'kuyou_goods_sales_profit',
    select: {
      单据日期: 't.`purchase_time`',
      单据编号: 't.`purchase_code`',
      客户名称: CUSTOMER_NAME,
      销售金额: 't.`all_money`',
      销售成本: 't.`sales_cost`',
      毛利: 't.`all_money` - COALESCE(t.`sales_cost`,0)',
      实收金额: 't.`pay_money`',
    },
    filters: [...timeRange()],
    fixedWhere: 'COALESCE(t.`sales_cost`,0) = 0',
    orderBy: 't.`id` DESC',
  },
  {
    key: 'customer_goodscoding',
    title: '客户价目表',
    group: '成本报表',
    from: 'kuyou_customer_goodscoding',
    select: {
      客户物料编码: 't.`customer_code`',
      商品编码: 't.`goods_code`',
      商品名称: GOODS_NAME,
      客户名称: CUSTOMER_NAME,
      单位: `(SELECT u.name FROM kuyou_unit u WHERE u.id = t.unit_id LIMIT 1)`,
    },
    filters: [
      { name: 'goods_code', label: '商品编码', type: 'text', op: 'LIKE' },
      { name: 'customers_id', label: '客户', type: 'select', ref: { table: 'kuyou_customers', labelField: 'customer_name' } },
    ],
    orderBy: 't.`id` DESC',
  },
  /* ---------------- 采购销售费用清单 ---------------- */
  {
    key: 'purchase_sale_expense',
    title: '采购销售费用清单',
    group: '资金报表',
    from: 'kuyou_cost',
    select: {
      单据日期: 't.`purchase_time`',
      单据编号: 't.`purchase_code`',
      业务类型: `CASE t.\`business_type\` WHEN '1' THEN '采购' WHEN '2' THEN '销售' WHEN '3' THEN '采购退回' WHEN '4' THEN '销售退回' ELSE t.\`business_type\` END`,
      供应商名称: `(SELECT s.supplyer_name FROM kuyou_suppliers s WHERE s.id = t.suppliers_id LIMIT 1)`,
      客户名称: `(SELECT c.customer_name FROM kuyou_customers c WHERE c.id = t.customers_id LIMIT 1)`,
      支出类别: `(SELECT e.name FROM kuyou_expend_type e WHERE e.id = t.expend_type_id LIMIT 1)`,
      收入类别: `(SELECT i.name FROM kuyou_income_type i WHERE i.id = t.income_type_id LIMIT 1)`,
      金额: 't.`money`',
      未付金额: 't.`pay_money`',
      审核状态: 't.`examine_status`',
      备注: 't.`remark`',
    },
    filters: [
      ...timeRange(),
      {
        name: 'business_type',
        label: '业务类型',
        type: 'select',
        enum: [
          { value: '1', label: '采购' },
          { value: '2', label: '销售' },
          { value: '3', label: '采购退回' },
          { value: '4', label: '销售退回' },
        ],
      },
      { name: 'suppliers_id', label: '供应商', type: 'select', ref: { table: 'kuyou_suppliers', labelField: 'supplyer_name' } },
      { name: 'customers_id', label: '客户', type: 'select', ref: { table: 'kuyou_customers', labelField: 'customer_name' } },
    ],
    orderBy: 't.`id` DESC',
  },
  /* ---------------- 序列号状态表 ---------------- */
  {
    key: 'serial_status',
    title: '序列号状态表',
    group: '库存报表',
    from: 'kuyou_goods_serial',
    select: {
      商品编码: 't.`goods_code`',
      商品名称: `(SELECT g.goods_name FROM kuyou_goods g WHERE g.id = t.goods_id LIMIT 1)`,
      序列号: 't.`serial`',
      仓库: `(SELECT s.name FROM kuyou_stores s WHERE s.id = t.stores_id LIMIT 1)`,
      在库状态: `CASE t.\`store_status\` WHEN '1' THEN '在库' WHEN '2' THEN '出库' ELSE '未入库' END`,
      业务状态: `CASE t.\`status\` WHEN '1' THEN '购货' WHEN '2' THEN '购货退货' WHEN '3' THEN '销货' WHEN '4' THEN '销货退货' WHEN '5' THEN '盘点' WHEN '6' THEN '其他' WHEN '7' THEN '盘盈' WHEN '8' THEN '其他入库' WHEN '9' THEN '盘亏' WHEN '10' THEN '其他出库' WHEN '11' THEN '组装' WHEN '12' THEN '组装' WHEN '13' THEN '拆卸' WHEN '14' THEN '拆卸' WHEN '15' THEN '生产' ELSE t.\`status\` END`,
      备注: 't.`remark`',
    },
    filters: [
      { name: 'goods_code', label: '商品编码', type: 'text', op: 'LIKE' },
      { name: 'serial', label: '序列号', type: 'text', op: 'LIKE' },
      { name: 'stores_id', label: '仓库', type: 'select', ref: { table: 'kuyou_stores', labelField: 'name' } },
      {
        name: 'store_status',
        label: '在库状态',
        type: 'select',
        enum: [
          { value: '0', label: '未入库' },
          { value: '1', label: '在库' },
          { value: '2', label: '出库' },
        ],
      },
    ],
    orderBy: 't.`id` DESC',
  },
];

/** 按主表名取报表定义 */
export function reportDef(key: string): ReportDef | undefined {
  return REPORTS.find((r) => r.key === key);
}

/** 按业务分组归类（菜单渲染用） */
export function groupedReports(): { group: string; items: ReportDef[] }[] {
  const map = new Map<string, ReportDef[]>();
  for (const r of REPORTS) {
    if (!map.has(r.group)) map.set(r.group, []);
    map.get(r.group)!.push(r);
  }
  return Array.from(map, ([group, items]) => ({ group, items }));
}
