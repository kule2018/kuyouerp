import request from '../utils/request';

/**
 * 专项业务 API（后端 src/modules/erp/special）
 *
 * 这些接口对应原 kuyou 中带计算逻辑的页面，不是标准 CRUD：
 * MRP 计算、智能补货、已销订购看板、计件计时工资、结账反结账、系统初始化。
 * 统一挂在 /kuyou/special 下。
 */

/** 生产计划的可选明细行（勾选后参与 MRP 展开） */
export function planLines(purchaseCode: string) {
  return request.get('/special/mrp/plan-lines', { params: { purchase_code: purchaseCode } });
}

/** MRP 结果列表 */
export function mrpList(params: { offset?: number; limit?: number } = {}) {
  return request.get('/special/mrp/list', { params });
}

/** MRP 结果明细（物料需求行） */
export function mrpDetail(id: number | string) {
  return request.get(`/special/mrp/detail/${id}`);
}

/**
 * 执行 MRP 计算
 * @param purchaseCode 生产计划单号
 * @param infoId       勾选的计划明细行 id（空数组=全部）
 */
export function mrpCompute(purchaseCode: string, infoId: Array<number | string> = []) {
  return request.post('/special/mrp/compute', {
    purchase_code: purchaseCode,
    info_id: infoId,
  });
}

/** 智能补货：建议采购量清单 */
export function replenishment(params: { start_time?: string; end_time?: string } = {}) {
  return request.get('/special/replenishment', { params });
}

/** 已销订购看板 */
export function soldOrdered(params: { keyword?: string; offset?: number; limit?: number } = {}) {
  return request.get('/special/sold-ordered', { params });
}

/** 工资表（type: piece 计件 | hour 计时） */
export function wages(params: { type?: string; offset?: number; limit?: number } = {}) {
  return request.get('/special/wages', { params });
}

/** 结账状态（启用日期 / 上次结账日期） */
export function checkoutStatus() {
  return request.get('/special/checkout/status');
}

/** 期末结账 */
export function doCheckout(checkdate: string) {
  return request.post('/special/checkout/do', { checkdate });
}

/** 反结账 */
export function undoCheckout() {
  return request.post('/special/checkout/undo');
}

/** 系统初始化（不可逆） */
export function initialization() {
  return request.post('/special/initialization', { confirm: 'INITIALIZE' });
}
