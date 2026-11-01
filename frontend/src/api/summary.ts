import request from '../utils/request';

/**
 * 汇总报表 API（后端：src/modules/erp/summary）
 * 与源端路径一致：
 *   kuyou/goods_purchase_summarys/index  采购汇总（按供应商）
 *   kuyou/goods_sales_summarys/index     销货汇总（按业务员）
 *   kuyou/goods_sales_summaryc/index     销货汇总（按客户）
 *   kuyou/revenue/index                  收入支出报表
 */

/** 采购汇总：按供应商，固定只看普通采购（purchase_type=1） */
export function purchaseSummarys(filter: Record<string, any> = {}, field?: string, order?: string) {
  const params: any = { filter: JSON.stringify(filter) };
  if (field) params.field = field;
  if (order) params.order = order;
  return request.get('/goods_purchase_summarys/index', { params });
}

/** 销货汇总：按业务员 */
export function salesSummarys(filter: Record<string, any> = {}, field?: string, order?: string) {
  const params: any = { filter: JSON.stringify(filter) };
  if (field) params.field = field;
  if (order) params.order = order;
  return request.get('/goods_sales_summarys/index', { params });
}

/** 销货汇总：按客户 */
export function salesSummaryc(filter: Record<string, any> = {}, field?: string, order?: string) {
  const params: any = { filter: JSON.stringify(filter) };
  if (field) params.field = field;
  if (order) params.order = order;
  return request.get('/goods_sales_summaryc/index', { params });
}

/** 收入支出报表（其他收入 + 其他支出） */
export function revenue(filter: Record<string, any> = {}) {
  return request.get('/revenue/index', { params: { filter: JSON.stringify(filter) } });
}

