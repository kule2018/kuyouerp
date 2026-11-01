import request from '../utils/request';

/**
 * 零散业务 API（后端 src/modules/erp/misc）
 *
 * 对应原 kuyou 前端直接以 ajax / 浏览器跳转方式调用的端点：
 *  - user_order/examine   用户订单审核（status 0 → 2）
 *  - user_order/deliver   用户订单发货（status 2 → 3，可带司机）
 *  - inventory/export     盘点表导出（xlsx 文件流）
 */

/** 用户订单审核（ids 逗号分隔，仅 status=0 可审） */
export function userOrderExamine(ids: string) {
  return request.post('/user_order/examine', { ids });
}

/**
 * 用户订单发货
 * @param ids  订单主键（逗号分隔）
 * @param body 发货信息：send_type=1 司机自送（diver_id 必填）；否则快递（express_code/express_num 可空）
 */
export function userOrderDeliver(ids: string, body: Record<string, any> = {}) {
  return request.post('/user_order/deliver', { ids, ...body });
}

/** 盘点表导出：直接拿 blob，由前端触发浏览器下载 */
export function inventoryExport() {
  return request.get('/inventory/export', { responseType: 'blob' });
}

/**
 * 盘点单联动查询：返回该盘点单可生成的盘盈 / 盘亏单清单
 * （对应源 inventory.js 行操作 `exchange` → `kuyou/Warehousing/checkInventory`）
 *
 * @param purchaseCode 盘点单编号
 * @param type         盘点类型，1=普通盘点（当前后端仅实现该分支）
 * @returns 形如 `[{ type, purchase_code, status, title }]`，
 *          status=1 盘盈单（→ 其他入库单），status=2 盘亏单（→ 其他出库单）
 */
export function inventoryCheck(purchaseCode: string, type = 1) {
  return request.get('/Warehousing/checkInventory', {
    params: { purchase_code: purchaseCode, type },
  });
}

/**
 * 原始单据附件上传（POST /kuyou/img/more，multipart，字段名 file）
 * 后端保存到 uploads 目录并返回可访问路径，与源 img/more 一致。
 * @returns { url, name }
 */
export function uploadEnclosure(file: File) {
  const fd = new FormData();
  fd.append('file', file);
  return request.post('/img/more', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
