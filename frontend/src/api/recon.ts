import request from '../utils/request';

/**
 * 对账与汇总 API（后端：src/modules/erp/recon）
 * 与源端路径一致：
 *   kuyou/customers_recon/index      客户对账单
 *   kuyou/suppliers_recon/index      供应商对账单
 *   kuyou/goods_log_summary/index    商品收发明细汇总
 *   kuyou/goods_serial_status/index  序列号状态
 */

/** 对账单合计字段（源端回传 all_* 五项） */
export interface ReconTotals {
  all_sale_money: number;
  all_receivable: number;
  all_cost: number;
  all_real_money: number;
  all_balance: number;
}

/**
 * 客户对账单
 * @param filter 过滤条件对象（purchase_time / customers_id / staff_member_id / id）
 * @param sort   排序字段
 * @param order  排序方向
 */
export function customersRecon(filter: Record<string, any> = {}, sort?: string, order?: string) {
  const params: any = { filter: JSON.stringify(filter) };
  if (sort) params.sort = sort;
  if (order) params.order = order;
  return request.get('/customers_recon/index', { params });
}

/** 供应商对账单（与客户对账单镜像） */
export function suppliersRecon(filter: Record<string, any> = {}, sort?: string, order?: string) {
  const params: any = { filter: JSON.stringify(filter) };
  if (sort) params.sort = sort;
  if (order) params.order = order;
  return request.get('/suppliers_recon/index', { params });
}

/** 商品收发明细汇总 */
export function goodsLogSummary(filter: Record<string, any> = {}) {
  return request.get('/goods_log_summary/index', { params: { filter: JSON.stringify(filter) } });
}

/**
 * 序列号状态
 * @param storeStatus 库存状态过滤，undefined 表示不过滤
 */
export function goodsSerialStatus(filter: Record<string, any> = {}, storeStatus?: any, page = 1, limit = 20) {
  const params: any = { filter: JSON.stringify(filter), page, limit };
  if (storeStatus !== undefined && storeStatus !== null && storeStatus !== '') params.store_status = storeStatus;
  return request.get('/goods_serial_status/index', { params });
}

