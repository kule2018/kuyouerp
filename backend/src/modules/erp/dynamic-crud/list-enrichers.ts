/**
 * 列表富化钩子注册表
 *
 * 通用动态 CRUD 的 index 返回数据库原始行；少数业务表（如用户订单）
 * 需要按源 FastAdmin 控制层的逻辑做联表 enrichment——
 * 带出销货单关联 sales_id、司机姓名，并把订货单明细展开成「一行一个商品」。
 * 业务模块通过本注册表注入富化函数，避免把特判写进通用引擎。
 *
 * 注册时机：业务 Service 的 onModuleInit（见 MiscService.enrichUserOrders）。
 */

/** 富化函数：入参为当前页原始行，返回替换后的行数组 */
export type ListEnricher = (rows: any[]) => Promise<any[]> | any[];

/** 表名 → 富化函数（同名重复注册以最后一次为准） */
const REGISTRY = new Map<string, ListEnricher>();

/** 注册某张表的列表富化函数 */
export function registerListEnricher(table: string, fn: ListEnricher): void {
  REGISTRY.set(table, fn);
}

/** 取某张表的富化函数（未注册返回 undefined） */
export function getListEnricher(table: string): ListEnricher | undefined {
  return REGISTRY.get(table);
}
