import request from '../utils/request';

/** BOM 清单列表 */
export function listBom(params: { page?: number; limit?: number; search?: string }) {
  return request({ url: 'bom/listBom', method: 'get', params });
}
/** 取 BOM 清单 + 物料明细 */
export function getBom(id: number | string) {
  return request({ url: `bom/getBom/${id}`, method: 'get' });
}
/** 保存 BOM 清单（主从） */
export function saveBom(body: { header?: Record<string, any>; materials?: any[] }) {
  return request({ url: 'bom/saveBom', method: 'post', data: body });
}
/** 删除 BOM 清单 */
export function delBom(id: number | string) {
  return request({ url: 'bom/delBom', method: 'post', data: { id } });
}

/** 工序列表（按 bomId 过滤） */
export function listProcedure(params: { bomId?: number | string; search?: string }) {
  return request({ url: 'bom/listProcedure', method: 'get', params });
}
/** 取工序 + 工序物料明细 */
export function getProcedure(id: number | string) {
  return request({ url: `bom/getProcedure/${id}`, method: 'get' });
}
/** 保存工序（主从） */
export function saveProcedure(body: { header?: Record<string, any>; materials?: any[] }) {
  return request({ url: 'bom/saveProcedure', method: 'post', data: body });
}
/** 删除工序 */
export function delProcedure(id: number | string) {
  return request({ url: 'bom/delProcedure', method: 'post', data: { id } });
}

