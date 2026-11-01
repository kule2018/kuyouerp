import request from '../utils/request';

/**
 * 通用报表 API（后端 src/modules/erp/report）
 * 报表定义与数据分离：先取定义渲染筛选表单，再按 key 取数据。
 */

/** 报表清单：含列定义与筛选器 */
export function listReports() {
  return request.get('/reports');
}

/**
 * 执行报表
 * @param key    报表标识
 * @param params 筛选参数（由报表定义动态生成）
 */
export function runReport(key: string, params: Record<string, any> = {}, offset = 0, limit = 50) {
  return request.get(`/report/${key}`, { params: { ...params, offset, limit } });
}
