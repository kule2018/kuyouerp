import request from '../utils/request';

/**
 * 动态 CRUD API（对齐原 kuyou FastAdmin 的 /kuyou/<模块>/<方法>）
 * 后端以数据库原始列名（snake_case）收发，字段与原系统完全一致。
 */

export interface ListParams {
  offset?: number;
  limit?: number;
  search?: string;
  filter?: string;
  op?: string;
  sort?: string;
  order?: string;
}

/** 列表（{total, rows}） */
export function list(table: string, params: ListParams = {}) {
  return request.get(`/${table}/index`, { params });
}

/** selectpage（含 list） */
export function selectpage(table: string, params: ListParams = {}) {
  return request.get(`/${table}/selectpage`, { params });
}

/** 单条详情 */
export function detail(table: string, id: number | string) {
  return request.get(`/${table}/detail/${id}`);
}

/** 新增 */
export function add(table: string, data: Record<string, any>) {
  return request.post(`/${table}/add`, data);
}

/** 编辑 */
export function edit(table: string, data: Record<string, any>) {
  return request.post(`/${table}/edit`, data);
}

/** 删除（ids 逗号分隔） */
export function del(table: string, ids: string) {
  return request.post(`/${table}/del`, { ids });
}
