/**
 * 外键关联映射（基础资料表单的选择器数据源）
 *
 * 对齐原 kuyou 表单中的 getSuppliers / getGoods / getUnit / choselist 等联动接口：
 * 某个业务表的外键列，编辑时应渲染成「可远程搜索的下拉」，数据取自被关联字典表。
 *
 * 约定：
 *  - key     = 外键列名（与 schema 原列名一致）
 *  - table   = 被关联字典表（下拉数据源）
 *  - value   = 写入外键列的值字段（字典表主键或业务编码）
 *  - label   = 展示用名称列
 *
 * 安全与一致性说明：
 *  - 仅收录「值字段确凿」的关联（id / 编码类），避免把存储名称的列误当外键；
 *  - 例：kuyou_warehouse 在原库是"其他出库单"文档表而非仓库实体，仓库实体为 kuyou_stores，
 *    因此不映射 warehouse_id，stores_id 才映射到 kuyou_stores。
 */
export interface Relation {
  table: string;
  value: string;
  label: string;
}

export const RELATIONS: Record<string, Relation> = {
  // 供应商
  supplyer_code: { table: 'kuyou_suppliers', value: 'supplyer_code', label: 'supplyer_name' },
  supplyer_id: { table: 'kuyou_suppliers', value: 'id', label: 'supplyer_name' },
  suppliers_id: { table: 'kuyou_suppliers', value: 'id', label: 'supplyer_name' },
  // 客户
  customers_id: { table: 'kuyou_customers', value: 'id', label: 'customer_name' },
  customer_id: { table: 'kuyou_customers', value: 'id', label: 'customer_name' },
  // 商品
  goods_code: { table: 'kuyou_goods', value: 'goods_code', label: 'goods_name' },
  goods_id: { table: 'kuyou_goods', value: 'id', label: 'goods_name' },
  // 仓库 / 账户 / 车间 / 单位 / 职员
  stores_id: { table: 'kuyou_stores', value: 'id', label: 'name' },
  accounts_id: { table: 'kuyou_accounts', value: 'id', label: 'account_name' },
  workshop_id: { table: 'kuyou_workshop', value: 'id', label: 'name' },
  unit_id: { table: 'kuyou_unit', value: 'id', label: 'name' },
  staff_id: { table: 'kuyou_staff_member', value: 'id', label: 'name' },
  // 分类 / 等级
  goods_type_id: { table: 'kuyou_goods_type', value: 'id', label: 'supplier_type_name' },
  customerlevel_id: { table: 'kuyou_customerlevel', value: 'id', label: 'name' },
  customertype_id: { table: 'kuyou_customertype', value: 'id', label: 'type_name' },
  supplyertype_id: { table: 'kuyou_supplyertype', value: 'id', label: 'supplier_type_name' },
};

/** 取某列的关联定义（无则 undefined） */
export function relationOf(prop: string): Relation | undefined {
  return RELATIONS[prop];
}
