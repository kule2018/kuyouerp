import request from '../utils/request';

/**
 * 打印 API（后端 print 模块：src/modules/erp/print）
 * 覆盖原 kuyou Prints.php：单据打印（按 id）+ 汇总表打印（按检索）。
 */

export interface PrintType {
  key: string;
  title: string;
  mode: 'document' | 'summary';
}

/** 打印类型清单 */
export function printTypes() {
  return request.get<PrintType[]>('/prints/types');
}

/** 取打印数据 */
export function printData(type: string, ids: string[] = [], search: Record<string, any> = {}) {
  const params: any = { type };
  if (ids.length) params.ids = ids.join(',');
  if (Object.keys(search).length) params.search = JSON.stringify(search);
  return request.get('/prints/print', { params });
}
