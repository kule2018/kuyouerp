// 自动生成，请勿手改。来源：kuyou 源系统 application/admin/view/kuyou/*/add|edit.html
//
// 记录每个基础资料表的「业务必填字段」（源表单 data-rule="required"）。
// 通用 CRUD 表单按 db/schema.sql 的列元数据生成，NOT NULL 与业务必填不在元数据里，
// 因此这里单独维护一份规则，供 crud.vue / document.vue 在提交前拦截空值。
//
// 重新生成：node scripts/gen-required.cjs

/** 表名 → 必填字段列表 */
export const REQUIRED_FIELDS: Record<string, string[]> = {
  kuyou_accounts: ['account_coding', 'account_name', 'account_type_id', 'balance', 'start_account_balance', 'start_account_time'],
  kuyou_address: ['connect_mobile', 'connect_name', 'connect_phone', 'detail_address', 'is_default', 'post_code'],
  kuyou_assemble_temp: ['temp_name'],
  kuyou_auxiliary: ['name', 'pid'],
  kuyou_banner: ['link', 'name', 'type_id'],
  kuyou_cost: ['customers_id', 'expend_type_id', 'income_type_id', 'suppliers_id'],
  kuyou_customerlevel: ['name'],
  kuyou_customers: ['customer_code', 'customer_name', 'customerlevel_id', 'customertype_id'],
  kuyou_customertype: ['pid', 'type_name'],
  kuyou_driver: ['name', 'phone'],
  kuyou_expend_type: ['name', 'pid'],
  kuyou_factory: ['customer_code', 'customer_name'],
  kuyou_goods: ['goods_code', 'goods_name', 'goods_type_id'],
  kuyou_goods_batch: ['attribute_id', 'goods_id', 'stores_id'],
  kuyou_goods_batch_info: ['attribute_id', 'batch_id', 'goods_id', 'purchase_id', 'purchase_info_id', 'stock', 'stores_id'],
  kuyou_goods_type: ['pid', 'supplier_type_name'],
  kuyou_income_type: ['name', 'pid'],
  kuyou_inventory: ['invertory_stock'],
  kuyou_inventory_serial: ['invertory_stock'],
  kuyou_invoicing: ['invoice', 'invoice_header', 'purchase_time'],
  kuyou_payment_account: ['account_code', 'account_id', 'payment_id'],
  kuyou_sales_invoicing: ['invoice', 'invoice_header'],
  kuyou_settlementtype: ['name'],
  kuyou_stores: ['name', 'store_code'],
  kuyou_suppliers: ['supplyer_code', 'supplyer_name', 'supplyertype_id'],
  kuyou_supplyertype: ['pid', 'supplier_type_img', 'supplier_type_name'],
  kuyou_third_account: ['account', 'name'],
  kuyou_unit: ['name'],
  kuyou_unit_conversion: ['advance_rate', 'basic_unit', 'sub_unit'],
  kuyou_warehouse: ['business_type'],
  kuyou_warehousing: ['business_type'],
  kuyou_workshop: ['code', 'name'],
  kuyou_writeoff: ['business_type'],
};

/**
 * 取某张表的必填字段
 * @param table 物理表名
 * @returns 必填字段数组，无配置返回空数组
 */
export function requiredOf(table: string): string[] {
  return REQUIRED_FIELDS[table] || [];
}
