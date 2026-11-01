/**
 * 专项业务配置：系统初始化
 *
 * 对齐原 kuyou `Initialization.php`：
 *  - 清空全部业务数据表（保留基础字典与系统表）
 *  - 将 kuyou_sets 的运营参数恢复为出厂默认值
 */

/** 初始化时清空的表（对应 PHP 控制器里的 $limitTable 数组） */
export const INIT_TABLES: string[] = [
  'kuyou_accounts', 'kuyou_accounts_copewith', 'kuyou_accounts_log', 'kuyou_accounts_receivable',
  'kuyou_accounts_transfer', 'kuyou_accounts_transfer_info', 'kuyou_address', 'kuyou_adjustment',
  'kuyou_adjustment_info', 'kuyou_allocation', 'kuyou_allocation_info', 'kuyou_assemble',
  'kuyou_assemble_info', 'kuyou_assemble_info_temp', 'kuyou_assemble_temp', 'kuyou_attr_combination',
  'kuyou_attribute', 'kuyou_aux_combination', 'kuyou_auxiliary', 'kuyou_collection',
  'kuyou_collection_account', 'kuyou_collection_sale', 'kuyou_cost', 'kuyou_customer_goodscoding',
  'kuyou_customers', 'kuyou_customers_user', 'kuyou_customertype', 'kuyou_expend_type',
  'kuyou_expenditure', 'kuyou_expenditure_info', 'kuyou_goods', 'kuyou_goods_attr',

  'kuyou_goods_batch', 'kuyou_goods_batch_exchange_info', 'kuyou_goods_batch_info',
  'kuyou_goods_batch_log', 'kuyou_goods_batch_sale_info', 'kuyou_goods_batch_salee_info',
  'kuyou_goods_batch_stock', 'kuyou_goods_exchange', 'kuyou_goods_exchange_info',
  'kuyou_goods_excpur', 'kuyou_goods_excpur_info', 'kuyou_goods_log', 'kuyou_goods_period',
  'kuyou_goods_price', 'kuyou_goods_purchase', 'kuyou_goods_purchase_info',
  'kuyou_goods_purchase_order', 'kuyou_goods_purchase_order_info', 'kuyou_goods_purchase_summary',
  'kuyou_goods_purord', 'kuyou_goods_purord_info', 'kuyou_goods_saleexc', 'kuyou_goods_saleexc_info',
  'kuyou_goods_saleord', 'kuyou_goods_saleord_info', 'kuyou_goods_sales', 'kuyou_goods_sales_exchange',
  'kuyou_goods_sales_exchange_info', 'kuyou_goods_sales_info', 'kuyou_goods_sales_order',
  'kuyou_goods_sales_order_info', 'kuyou_goods_sales_profit', 'kuyou_goods_sales_summary',
  'kuyou_goods_serial', 'kuyou_goods_serial_log', 'kuyou_goods_stock', 'kuyou_goods_stock_warning',
  'kuyou_goods_store_info',

  'kuyou_goods_type', 'kuyou_income', 'kuyou_income_info', 'kuyou_income_type', 'kuyou_inventory',
  'kuyou_inventory_info', 'kuyou_inventory_serial', 'kuyou_inventory_serial_info', 'kuyou_invoicing',
  'kuyou_invoicing_log', 'kuyou_payment', 'kuyou_payment_account', 'kuyou_payment_log',
  'kuyou_payment_sale', 'kuyou_sales_invoicing', 'kuyou_sales_invoicing_log', 'kuyou_sales_payment_log',
  'kuyou_settlementtype', 'kuyou_spendingtype', 'kuyou_split', 'kuyou_split_info',
  'kuyou_split_info_temp', 'kuyou_split_temp', 'kuyou_staff_member', 'kuyou_stores', 'kuyou_suppliers',
  'kuyou_suppliers_user', 'kuyou_supplyertype', 'kuyou_transfers', 'kuyou_unit',
  'kuyou_unit_conversion', 'kuyou_warehouse', 'kuyou_warehouse_info', 'kuyou_warehousing',
  'kuyou_warehousing_info', 'kuyou_writeoff', 'kuyou_writeoff_info', 'kuyou_writeoff_log',
  'kuyou_writeoff_source',

  'kuyou_enclosure', 'kuyou_enclosure_log',
  'kuyou_driver', 'kuyou_third_account', 'kuyou_banner',
  'kuyou_user', 'kuyou_user_address', 'kuyou_user_cart', 'kuyou_user_history', 'kuyou_user_oauth',
  'kuyou_user_order', 'kuyou_user_orderinfo', 'kuyou_user_ordersale', 'kuyou_user_ordersaleinfo',

  'kuyou_acceptance', 'kuyou_acceptance_info', 'kuyou_material', 'kuyou_material_info', 'kuyou_mrp',
  'kuyou_mrp_info', 'kuyou_outsourcing', 'kuyou_outsourcing_info', 'kuyou_picking',
  'kuyou_picking_info', 'kuyou_plan', 'kuyou_plan_info', 'kuyou_production', 'kuyou_production_info',
  'kuyou_workshop', 'kuyou_bom', 'kuyou_bom_info', 'kuyou_bom_procedure', 'kuyou_factory',
  'kuyou_factory_user',
];

/** 初始化后 kuyou_sets 的出厂默认值（name -> {value, is_checked}） */
export const INIT_SETS: Array<{ name: string; value: string; is_checked: number }> = [
  { name: 'company_name', value: 'XX公司', is_checked: 0 },
  { name: 'company_address', value: 'XX公司地址', is_checked: 0 },
  { name: 'company_phone', value: '0816-6666666', is_checked: 0 },
  { name: 'company_tax', value: '', is_checked: 0 },
  { name: 'company_zipcode', value: '123456', is_checked: 0 },
  { name: 'price_decimal', value: '1', is_checked: 0 },
  { name: 'number_decimal', value: '0', is_checked: 0 },
  { name: 'valuation', value: '1', is_checked: 0 },
  { name: 'examine', value: '', is_checked: 1 },
  { name: 'taxes', value: '13', is_checked: 0 },
  { name: 'price_taxes', value: '', is_checked: 0 },
  { name: 'auxiliary', value: '', is_checked: 0 },
  { name: 'serial', value: '', is_checked: 0 },
  { name: 'batch', value: '', is_checked: 0 },
  { name: 'earing', value: '', is_checked: 0 },
  { name: 'stores', value: '', is_checked: 0 },
  { name: 'no_edittime', value: '', is_checked: 0 },
  { name: 'discount', value: '', is_checked: 0 },
  { name: 'customer', value: '', is_checked: 0 },
  { name: 'last_read', value: '', is_checked: 0 },
  { name: 'price_sale', value: '', is_checked: 0 },
  { name: 'price_buy', value: '', is_checked: 0 },
  { name: 'price_sale_last', value: '', is_checked: 0 },
  { name: 'price_buy_last', value: '', is_checked: 0 },
  { name: 'secret', value: '', is_checked: 0 },
  { name: 'appid', value: '', is_checked: 0 },
  { name: 'appsecret', value: '', is_checked: 0 },
];
