import request from '../utils/request';

/**
 * 开票登记 API（后端 invoicing 模块：src/modules/erp/invoicing）
 * 覆盖原 kuyou 采购开票(Invoicing) 与 销货开票(SalesInvoicing)。
 * kind: 'purchase' 采购开票 | 'sales' 销货开票
 */

export interface InvoiceListParams {
  offset?: number;
  limit?: number;
  begin_time?: string;
  end_time?: string;
  party?: string;
  bill_codes?: string;
}

/** 已登记列表 */
export function invoiceList(kind: 'purchase' | 'sales', params: InvoiceListParams = {}) {
  return request.get(`/invoicing/${kind}/list`, { params });
}

/** 待开票列表（invoice_status=0） */
export function invoicePending(kind: 'purchase' | 'sales') {
  return request.get(`/invoicing/${kind}/pending`);
}

/** 开票台账 */
export function invoiceLog(kind: 'purchase' | 'sales', params: InvoiceListParams = {}) {
  return request.get(`/invoicing/${kind}/log`, { params });
}

/** 开票登记：选多条 + 发票号 + 抬头 */
export function invoiceRegister(
  kind: 'purchase' | 'sales',
  payload: { rows: { id: number; invoicing: number }[]; invoice: string; invoice_header: string },
) {
  return request.post(`/invoicing/${kind}/register`, payload);
}

/** 删除台账（回冲） */
export function invoiceDel(kind: 'purchase' | 'sales', ids: number[]) {
  return request.post(`/invoicing/${kind}/del`, { ids });
}
