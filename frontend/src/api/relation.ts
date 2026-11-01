import request from '../utils/request';

/**
 * 关联字典下拉选项（基础资料表单外键选择器数据源）
 * 后端按表返回 value/label 全量选项（字典表小，前端本地过滤）。
 */
export function relationOptions(table: string, value: string, label: string) {
  return request({ url: 'relation/options', method: 'get', params: { table, value, label } });
}

