import request from '../utils/request';
import type { ListParams } from './dynamic';

/**
 * 主从单据 API（后端单据引擎：src/modules/erp/document）
 * 路由与原 kuyou FastAdmin 的 /kuyou/<模块>/<方法> 保持一致。
 */

/** 已注册单据清单（后端按真实存在的表过滤后返回） */
export function listDocuments() {
  return request.get('/documents');
}

/**
 * 单据列表（走单据引擎的 doclist）
 * 与通用 CRUD 的 index 区别：会叠加后端配置的业务固定过滤，
 * 例如零售单强制 order_type=2，保证同一张物理表的多个业务页面互不串数据。
 */
export function docList(table: string, params: ListParams = {}) {
  return request.get(`/${table}/doclist`, { params });
}

/** 单据详情：主表 + 明细行 */
export function docDetail(table: string, id: number | string) {
  return request.get(`/${table}/doc/${id}`);
}

/** 主从整体保存（事务） */
export function docSave(table: string, header: Record<string, any>, lines: Record<string, any>[]) {
  return request.post(`/${table}/save`, { header, lines });
}

/** 审核 / 反审核 */
export function docAudit(table: string, id: number | string, state: 0 | 1) {
  return request.post(`/${table}/audit`, { id, state });
}

/** 对单 / 反对单（只翻核对位 check_status，不过账） */
export function docCounter(table: string, id: number | string, state: 0 | 1) {
  return request.post(`/${table}/counter`, { id, state });
}

/** 删除单据 */
export function docDel(table: string, id: number | string) {
  return request.post(`/${table}/del`, { ids: String(id) });
}

/**
 * 订货单转销货单预取（源 goods_sales/add?order_id=）
 * 按用户订单带出客户、收货地址与商品明细，打开新增页即自动填充。
 * @param orderId 用户订单主键
 */
export function docPrefill(table: string, orderId: number | string) {
  return request.get(`/${table}/prefill`, { params: { order_id: orderId } });
}
