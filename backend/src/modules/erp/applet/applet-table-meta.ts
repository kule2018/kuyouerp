import { TableMeta } from '../../../table-meta';

/**
 * 小程序（生产小程序）所需的、但原 TABLE_META 未登记的表。
 * 这些表与 kuyou 库完全一致，仅用于小程序端的动态 CRUD 白名单。
 * 在 applet.module 加载时合并进全局 TABLE_META（不改自动生成文件）。
 *
 * types 仅用于列表快速搜索时识别文本列，这里统一按 varchar 处理，不影响增删改查。
 */
function def(columns: string[]): TableMeta {
  const types: Record<string, string> = {};
  for (const c of columns) types[c] = 'varchar(255)';
  types['id'] = 'int(11)';
  return { pk: 'id', auto: true, hasDt: false, columns, types };
}

export const APPLET_TABLE_META: Record<string, TableMeta> = {
  kuyou_production: def([
    'id', 'plan_code', 'purchase_code', 'purchase_time', 'delivery_time', 'workshop_id',
    'work_id', 'goods_name', 'goods_code', 'goods_unit', 'default_unit', 'number',
    'finish_number', 'basic_nmber', 'unit_price', 'all_money', 'examine_status',
    'examine_time', 'status', 'remark', 'preparation_id', 'examine_id', 'operation_id',
    'mrp_status', 'work_time', 'finish_time', 'createtime', 'updatetime',
  ]),
  kuyou_mrp: def([
    'id', 'purchase_code', 'purchase_time', 'delivery_time', 'workshop_id', 'goods_name',
    'goods_code', 'goods_unit', 'default_unit', 'number', 'basic_nmber', 'unit_price',
    'all_money', 'examine_status', 'examine_time', 'status', 'remark', 'preparation_id',
    'examine_id', 'operation_id', 'mrp_status', 'createtime', 'updatetime',
  ]),
  kuyou_sets: def([
    'id', 'admin_id', 'type', 'name', 'nickname', 'value', 'is_edit', 'notice',
    'explain', 'is_checked', 'set',
  ]),
  kuyou_production_info: def([
    'id', 'type', 'production_id', 'goods_id', 'goods_code', 'goods_name', 'goods_note',
    'unit_id', 'default_unit', 'purchase', 'number', 'basic_nmber', 'money', 'remark',
    'stock_number', 'need_number', 'requisition_number', 'use_number', 'back_number',
    'createtime', 'updatetime',
  ]),
  kuyou_mrp_info: def([
    'id', 'plan_id', 'goods_id', 'goods_code', 'goods_name', 'goods_note', 'unit_id',
    'default_unit', 'purchase', 'number', 'basic_nmber', 'stock', 'buy_number', 'money',
    'remark', 'createtime', 'updatetime',
  ]),
  kuyou_plan_info: def([
    'id', 'plan_id', 'goods_id', 'goods_code', 'goods_name', 'goods_note', 'unit_id',
    'default_unit', 'purchase', 'number', 'basic_nmber', 'money', 'remark',
    'createtime', 'updatetime',
  ]),
  kuyou_picking_info: def([
    'id', 'type', 'production_id', 'goods_id', 'goods_code', 'goods_name', 'goods_note',
    'unit_id', 'default_unit', 'purchase', 'number', 'basic_nmber', 'money', 'remark',
    'stock_number', 'need_number', 'requisition_number', 'use_number', 'back_number',
    'stores_id', 'allow_stock', 'goods_attr', 'batch_id', 'batch_name', 'manufacture',
    'guarantee', 'validity', 'period', 'createtime', 'updatetime',
  ]),
  kuyou_material_info: def([
    'id', 'type', 'production_id', 'goods_id', 'goods_code', 'goods_name', 'goods_note',
    'unit_id', 'default_unit', 'purchase', 'number', 'basic_nmber', 'money', 'remark',
    'stock_number', 'need_number', 'requisition_number', 'use_number', 'back_number',
    'stores_id', 'allow_stock', 'goods_attr', 'batch_id', 'batch_name', 'manufacture',
    'guarantee', 'validity', 'period', 'createtime', 'updatetime',
  ]),
  kuyou_outsourcing_info: def([
    'id', 'type', 'production_id', 'goods_id', 'goods_code', 'goods_name', 'goods_note',
    'unit_id', 'default_unit', 'purchase', 'number', 'basic_nmber', 'money', 'remark',
    'stock_number', 'need_number', 'requisition_number', 'use_number', 'back_number',
    'stores_id', 'allow_stock', 'goods_attr', 'batch_id', 'batch_name', 'manufacture',
    'guarantee', 'validity', 'period', 'createtime', 'updatetime',
  ]),
  kuyou_bom_info: def([
    'id', 'bom_id', 'procedure_id', 'goods_id', 'goods_code', 'goods_name', 'goods_note',
    'unit_id', 'default_unit', 'purchase', 'number', 'basic_nmber', 'money', 'remark',
    'createtime', 'updatetime',
  ]),
};
