import request from '../utils/request';

/**
 * 回收站 + 单据模板 API（后端：src/modules/erp/recycle）
 * 与源 kuyou 的 recyclebin / restore / destroy、savetemp / gettemp 路径一致。
 */

/** 回收站列表参数（按页取，与通用列表的 offset 约定不同） */
export interface RecycleParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: string;
}

/** 支持回收站的表（与后端 SoftDelete 白名单一致） */
/** 支持回收站的表（去 kuyou_ 前缀），与后端 RecycleService.RECYCLE_TABLES 保持一致，
 *  均为数据库中实际含有 deletetime 软删字段的表。 */
export const RECYCLABLE = [
  'accounts',
  'accounts_log',
  'customers_user',
  'factory_user',
  'goods',
  'goods_period',
  'goods_price',
  'goods_stock',
  'settlementtype',
  'suppliers_user',
  'transfers',
  'user',
  'user_order',
];

/** 判断某表是否有回收站 */
export function hasRecycle(table: string): boolean {
  const t = String(table || '').replace(/^kuyou_/, '');
  return RECYCLABLE.indexOf(t) >= 0;
}

/** 回收站列表：只取已软删（deletetime 非空）的数据 */
export function recycleList(table: string, params: RecycleParams = {}) {
  const t = String(table || '').replace(/^kuyou_/, '');
  return request.get(`/${t}/recyclebin`, { params });
}

/** 还原：把 deletetime 置回 NULL */
export function recycleRestore(table: string, ids: (number | string)[]) {
  const t = String(table || '').replace(/^kuyou_/, '');
  return request.post(`/${t}/restore`, { ids: ids.join(',') });
}

/** 彻底删除：物理删除（suppliers 会级联清理联系人） */
export function recycleDestroy(table: string, ids: (number | string)[]) {
  const t = String(table || '').replace(/^kuyou_/, '');
  return request.post(`/${t}/destroy`, { ids: ids.join(',') });
}

/**
 * 单据另存为模板
 * @param biz assemble（组装）| split（拆卸）
 * @param tempName 模板名称（须唯一）
 * @param row 表单数据（明细字段为数组）
 */
export function saveTemp(biz: 'assemble' | 'split', tempName: string, row: Record<string, any>) {
  return request.post(`/${biz}/savetemp`, { temp_name: tempName, row });
}

/**
 * 取用模板：返回 { info: 明细行[], temp: 主表 }
 */
export function getTemp(biz: 'assemble' | 'split', id: number | string) {
  return request.post(`/${biz}_temp/gettemp`, { id });
}
