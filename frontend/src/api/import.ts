import request from '../utils/request';

/**
 * 基础资料 Excel 导入 API（后端：src/modules/erp/import）
 * 与源 kuyou 的 ajax/upload + kuyou/<模块>/import 路径一致。
 */

/** 支持导入的基础资料（后端白名单，前端据此显示「导入」按钮） */
export const IMPORTABLE = [
  'customers',
  'suppliers',
  'goods',
  'staff_member',
  'stores',
  'customer_goodscoding',
  'factory',
  'workshop',
  'inventory',
];

/**
 * 判断某表是否开放导入
 * 专用导入覆盖 9 类基础资料；其余 kuyou 表走通用导入（按列注释匹配表头），
 * 与源 FastAdmin 默认给每个模块都提供「导入」按钮的行为一致。
 */
export function canImport(table: string): boolean {
  const t = String(table || '').replace(/^kuyou_/, '');
  if (!t) return false;
  // 明细表等无独立导入意义的表的排除交由后端白名单处理，此处只做基本判断
  return true;
}

/** 是否走专用导入（字段校验与关联写入更复杂） */
export function hasSpecialImport(table: string): boolean {
  const t = String(table || '').replace(/^kuyou_/, '');
  return IMPORTABLE.indexOf(t) >= 0;
}

/**
 * 上传导入文件（对应源 ajax/upload）
 * @param file 用户选择的 xls / xlsx / csv 文件
 * @returns 服务端相对路径，如 /uploads/xxx.xlsx
 */
export async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res: any = await request.post('/ajax/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res?.data?.url || '';
}

/**
 * 执行导入
 * @param table 目标实体（customers / goods / ...）
 * @param file  上传后返回的路径
 * @param editstatus 0=编号已存在即报错 1=允许更新（源默认 1）
 * @param skulist 商品导入时选定的辅助属性 ID 列表
 * @returns { add, update } 新增与更新条数
 */
export function runImport(
  table: string,
  file: string,
  editstatus: 0 | 1 = 1,
  skulist: (number | string)[] = [],
) {
  const t = String(table || '').replace(/^kuyou_/, '');
  return request.post(`/${t}/import`, { file, editstatus, skulist });
}
