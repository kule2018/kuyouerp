/**
 * 小程序实体名（URL 第一段）-> 数据库表 + 子表信息。
 * 小程序以 POST 调用 /kuyou/applet/<entity>/<action>。
 *
 * infoTable/fk：主表 add/edit 时，body.info_list（JSON 字符串或数组）写入子表，
 * 子表以 fk 列关联主表主键（与 PHP 端 kuyou_*_info 的写入逻辑一致）。
 */
export interface EntityDef {
  table: string;
  infoTable?: string;
  fk?: string;
}

export const ENTITY_MAP: Record<string, EntityDef> = {
  plan: { table: 'kuyou_plan', infoTable: 'kuyou_plan_info', fk: 'plan_id' },
  productions: { table: 'kuyou_production', infoTable: 'kuyou_production_info', fk: 'production_id' },
  bom: { table: 'kuyou_bom', infoTable: 'kuyou_bom_info', fk: 'bom_id' },
  procedure: { table: 'kuyou_bom_procedure' },
  material: { table: 'kuyou_material', infoTable: 'kuyou_material_info', fk: 'production_id' },
  mrps: { table: 'kuyou_mrp', infoTable: 'kuyou_mrp_info', fk: 'mrp_id' },
  picking: { table: 'kuyou_picking', infoTable: 'kuyou_picking_info', fk: 'production_id' },
  outsourcing: { table: 'kuyou_outsourcing', infoTable: 'kuyou_outsourcing_info', fk: 'production_id' },
  acceptance: { table: 'kuyou_acceptance' },
  acceptances: { table: 'kuyou_acceptance' },
  workshop: { table: 'kuyou_workshop' },
  goods: { table: 'kuyou_goods' },
  customers: { table: 'kuyou_customers' },
  staff_member: { table: 'kuyou_staff_member' },
  unit: { table: 'kuyou_unit' },
  unit_conversion: { table: 'kuyou_unit_conversion' },
  auxiliary: { table: 'kuyou_auxiliary' },
  factory: { table: 'kuyou_factory' },
  stores: { table: 'kuyou_stores' },
  goods_exchange: { table: 'kuyou_goods_exchange' },
  goods_purchase: { table: 'kuyou_goods_purchase' },
  inventory_serial: { table: 'kuyou_inventory_serial' },
  sets: { table: 'kuyou_sets' },
};

export function resolveEntity(entity: string): EntityDef | undefined {
  return ENTITY_MAP[entity.toLowerCase()];
}
