// 自动生成，请勿手改。来源：backend/src/modules/erp/report/report.config.ts
export interface ReportMeta { key: string; title: string; group: string; columns: string[] }

export const REPORT_META: ReportMeta[] = [
  {
    "key": "purchase_detail",
    "title": "采购明细表",
    "group": "采购报表",
    "columns": [
      "单据日期",
      "单据编号",
      "供应商编码",
      "供应商名称",
      "商品编码",
      "商品名称",
      "规格型号",
      "单位",
      "仓库",
      "数量",
      "单价",
      "金额",
      "已付金额",
      "备注"
    ]
  },
  {
    "key": "purchase_order_trace",
    "title": "采购订单跟踪表",
    "group": "采购报表",
    "columns": [
      "单据日期",
      "单据编号",
      "供应商编码",
      "供应商名称",
      "订单数量",
      "已入库数量",
      "订单金额",
      "审核状态",
      "关闭状态",
      "备注"
    ]
  },
  {
    "key": "purchase_summary_goods",
    "title": "采购汇总表(按商品)",
    "group": "采购报表",
    "columns": [
      "商品编码",
      "商品名称",
      "规格型号",
      "单位",
      "合计数量",
      "合计金额",
      "税额合计",
      "单据数"
    ]
  },
  {
    "key": "purchase_summary_supplier",
    "title": "采购汇总表(按供应商)",
    "group": "采购报表",
    "columns": [
      "供应商编码",
      "供应商名称",
      "单据数",
      "合计数量",
      "合计金额",
      "已付金额",
      "欠款金额"
    ]
  },
  {
    "key": "purchase_payment_list",
    "title": "采购付款一览表",
    "group": "采购报表",
    "columns": [
      "单据日期",
      "付款单号",
      "源单编号",
      "结算账户",
      "付款金额",
      "结算方式",
      "备注"
    ]
  },
  {
    "key": "sales_detail",
    "title": "商品销售明细",
    "group": "销售报表",
    "columns": [
      "单据日期",
      "单据编号",
      "客户编码",
      "客户名称",
      "商品编码",
      "商品名称",
      "仓库",
      "数量",
      "单价",
      "金额",
      "已收金额"
    ]
  },
  {
    "key": "sales_order_trace",
    "title": "销售订单跟踪表",
    "group": "销售报表",
    "columns": [
      "单据日期",
      "单据编号",
      "客户名称",
      "订单数量",
      "已出库数量",
      "订单金额",
      "审核状态",
      "备注"
    ]
  },
  {
    "key": "sales_summary_goods",
    "title": "销售汇总表(按商品)",
    "group": "销售报表",
    "columns": [
      "商品编码",
      "商品名称",
      "规格型号",
      "单位",
      "合计数量",
      "合计金额",
      "成本合计"
    ]
  },
  {
    "key": "sales_summary_customer",
    "title": "销售汇总表(按客户)",
    "group": "销售报表",
    "columns": [
      "客户编码",
      "客户名称",
      "单据数",
      "合计数量",
      "合计金额",
      "已收金额"
    ]
  },
  {
    "key": "sales_summary_user",
    "title": "销售汇总表(按销售员)",
    "group": "销售报表",
    "columns": [
      "销售员",
      "单据数",
      "合计数量",
      "合计金额",
      "客户数"
    ]
  },
  {
    "key": "sales_profit",
    "title": "销售利润表",
    "group": "销售报表",
    "columns": [
      "单据日期",
      "单据编号",
      "客户名称",
      "销售金额",
      "销售成本",
      "毛利",
      "费用",
      "实收金额"
    ]
  },
  {
    "key": "sales_rank",
    "title": "销售排行表",
    "group": "销售报表",
    "columns": [
      "商品编码",
      "商品名称",
      "销量",
      "销售额",
      "毛利"
    ]
  },
  {
    "key": "sales_collection_list",
    "title": "销售收款一览表",
    "group": "销售报表",
    "columns": [
      "单据日期",
      "收款单号",
      "结算账户",
      "收款金额",
      "结算方式",
      "备注"
    ]
  },
  {
    "key": "stock_balance",
    "title": "商品库存余额表",
    "group": "库存报表",
    "columns": [
      "商品编码",
      "商品名称",
      "规格属性",
      "仓库",
      "库存数量",
      "单位成本",
      "库存金额",
      "预警下限"
    ]
  },
  {
    "key": "stock_warning",
    "title": "库存预警表",
    "group": "库存报表",
    "columns": [
      "商品编码",
      "商品名称",
      "仓库",
      "当前库存",
      "预警下限",
      "预警上限",
      "缺货数量"
    ]
  },
  {
    "key": "goods_io_detail",
    "title": "商品收发存明细表",
    "group": "库存报表",
    "columns": [
      "单据日期",
      "单据编号",
      "业务类型",
      "商品编码",
      "商品名称",
      "仓库",
      "入库数量",
      "出库数量",
      "结存数量",
      "备注"
    ]
  },
  {
    "key": "goods_io_summary",
    "title": "商品收发存汇总表",
    "group": "库存报表",
    "columns": [
      "商品编码",
      "商品名称",
      "仓库",
      "入库合计",
      "出库合计",
      "结存数量"
    ]
  },
  {
    "key": "batch_trace",
    "title": "批次跟踪表",
    "group": "库存报表",
    "columns": [
      "商品编码",
      "商品名称",
      "批次号",
      "仓库",
      "生产日期",
      "有效期",
      "保质期"
    ]
  },
  {
    "key": "batch_validity",
    "title": "批次保质期清单",
    "group": "库存报表",
    "columns": [
      "商品编码",
      "商品名称",
      "批次号",
      "生产日期",
      "有效期",
      "保质期(天)"
    ]
  },
  {
    "key": "serial_trace",
    "title": "序列号跟踪表",
    "group": "库存报表",
    "columns": [
      "序列号",
      "商品编码",
      "商品名称",
      "仓库",
      "状态",
      "出入库单号",
      "备注"
    ]
  },
  {
    "key": "receivable_detail",
    "title": "应收账款明细表",
    "group": "资金报表",
    "columns": [
      "单据日期",
      "单据编号",
      "客户名称",
      "应收金额",
      "已收金额",
      "欠款余额",
      "业务类型",
      "备注"
    ]
  },
  {
    "key": "payable_detail",
    "title": "应付账款明细表",
    "group": "资金报表",
    "columns": [
      "单据日期",
      "单据编号",
      "供应商名称",
      "应付金额",
      "已付金额",
      "欠款余额",
      "业务类型",
      "备注"
    ]
  },
  {
    "key": "customer_statement",
    "title": "客户对账单",
    "group": "资金报表",
    "columns": [
      "客户编码",
      "客户名称",
      "应收合计",
      "已收合计",
      "欠款余额",
      "单据数"
    ]
  },
  {
    "key": "supplier_statement",
    "title": "供应商对账单",
    "group": "资金报表",
    "columns": [
      "供应商编码",
      "供应商名称",
      "应付合计",
      "已付合计",
      "欠款余额",
      "单据数"
    ]
  },
  {
    "key": "cash_bank_report",
    "title": "现金银行报表",
    "group": "资金报表",
    "columns": [
      "账户编码",
      "账户名称",
      "期初余额",
      "当前余额",
      "是否默认",
      "状态"
    ]
  },
  {
    "key": "other_income_detail",
    "title": "其他收支明细表",
    "group": "资金报表",
    "columns": [
      "单据日期",
      "单据编号",
      "客户",
      "收入金额",
      "已收金额",
      "备注"
    ]
  },
  {
    "key": "profit_report",
    "title": "利润表",
    "group": "资金报表",
    "columns": [
      "业务月份",
      "销售收入",
      "销售成本",
      "毛利",
      "费用",
      "净利"
    ]
  },
  {
    "key": "purchase_sale_expense",
    "title": "采购销售费用清单",
    "group": "资金报表",
    "columns": [
      "单据日期",
      "单据编号",
      "业务类型",
      "供应商名称",
      "客户名称",
      "支出类别",
      "收入类别",
      "金额",
      "未付金额",
      "审核状态",
      "备注"
    ]
  },
  {
    "key": "serial_status",
    "title": "序列号状态表",
    "group": "库存报表",
    "columns": [
      "商品编码",
      "商品名称",
      "序列号",
      "仓库",
      "在库状态",
      "业务状态",
      "备注"
    ]
  }
];

export function groupedReports(): { group: string; items: ReportMeta[] }[] {
  const map = new Map<string, ReportMeta[]>();
  for (const r of REPORT_META) {
    if (!map.has(r.group)) map.set(r.group, []);
    map.get(r.group)!.push(r);
  }
  return Array.from(map, ([group, items]) => ({ group, items }));
}
