/**
 * 响应包装工具
 * 与原 FastAdmin 返回约定对齐：
 *  - 成功：{ code: 1, msg: '操作成功', data: ... }
 *  - 列表：{ total: N, rows: [...] }（layui table 约定，不包 code）
 *  - 失败：由 AllExceptionsFilter 统一返回 { code: 0, msg, data: null }
 */

/** 成功（带 data） */
export function ok(data: any = null, msg = '操作成功') {
  return { code: 1, msg, data };
}

/** 成功（无 data，仅提示） */
export function okMsg(msg = '操作成功') {
  return { code: 1, msg, data: null };
}

/**
 * 小程序订货端专用成功返回（与 PHP order 模块约定一致：code = 200）
 * 小程序 request.js 以 res.code == 200 判定成功，故此处必须返回 200，
 * 不能复用管理端 ok() 的 code:1。
 */
export function ok200(data: any = null, msg = '成功') {
  return { code: 200, msg, data };
}

/**
 * 列表（layui table 约定）
 * @param total 总条数，或直接传 { total, rows } 形式的服务返回值
 * @param rows  当前页数据（传对象形式时省略）
 * @param extra 附加字段（报表需要回传列定义与合计，仍与原约定兼容）
 */
export function table(total: number | { total: number; rows: any[] }, rows?: any[], extra?: Record<string, any>) {
  if (typeof total === 'object' && total !== null) {
    return { total: total.total, rows: total.rows, ...(extra || {}) };
  }
  return { total, rows: rows || [], ...(extra || {}) };
}
