import request from '../utils/request';

/**
 * 统计 / 数据中心 API（后端 stats 模块：src/modules/erp/stats）
 * 覆盖原 kuyou Intercourse.php（往来欠款）+ Datainfo.php（数据中心看板）。
 */

/** 往来单位欠款表 */
export function intercourse(types: number[] = [], keyword = '') {
  const params: any = {};
  if (types.length) params.types = types.join(',');
  if (keyword) params.keyword = keyword;
  return request.get('/intercourse/index', { params });
}

/** 数据中心看板：1购货 2销货 3库存 4账户 */
export function datainfo(types: number) {
  return request.get('/datainfo/index', { params: { types } });
}

/** 本月购销汇总 */
export function datainfoSummary() {
  return request.get('/datainfo/summary');
}

/** 生产成本统计（kuyou Acceptances.php） */
export function productionCost(params: any = {}) {
  return request.get('/acceptances/cost', { params });
}

/** 生产数据面板汇总 */
export function productionSummary() {
  return request.get('/production/summary');
}
