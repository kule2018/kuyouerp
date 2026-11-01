import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { TABLE_META } from '../../../table-meta';

/**
 * 允许作为下拉数据源的字典表（基础资料，均为非敏感的名称 / 编码表）
 * 对齐原 kuyou 表单的 getSuppliers / getGoods / getUnit / choselist 等联动。
 */
const ALLOWED_RELATION_TABLES = new Set<string>([
  'kuyou_suppliers', 'kuyou_customers', 'kuyou_goods', 'kuyou_stores', 'kuyou_accounts',
  'kuyou_workshop', 'kuyou_unit', 'kuyou_staff_member', 'kuyou_goods_type',
  'kuyou_customerlevel', 'kuyou_customertype', 'kuyou_supplyertype',
]);

/**
 * 关联字典服务：为前端下拉框提供某个字典表的「值 + 名称」全量选项。
 * 安全：表名 / 列名均走白名单校验（表需在 ALLOWED_RELATION_TABLES，列需在该表 TABLE_META 内），
 *       字典表数据量小，全量返回后由前端本地过滤。
 */
@Injectable()
export class RelationService {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  /**
   * 取某字典表的下拉选项
   * @param table 字典表名
   * @param value 写入外键列的值字段（如 id / goods_code）
   * @param label 展示名称列（如 customer_name）
   * @returns { options: [{ value, label }] }
   */
  async options(table: string, value: string, label: string) {
    if (!ALLOWED_RELATION_TABLES.has(table) || !TABLE_META[table]) {
      throw new BadRequestException(`不支持的关联表: ${table}`);
    }
    const meta = TABLE_META[table];
    if (!meta.columns.includes(value) || !meta.columns.includes(label)) {
      throw new BadRequestException('非法取值 / 名称字段');
    }
    const rows = await this.conn.query(
      `SELECT \`${value}\` AS value, \`${label}\` AS label
       FROM \`${table}\` WHERE \`${value}\` IS NOT NULL AND \`${value}\` <> ''
       ORDER BY \`${value}\` ASC LIMIT 500`,
    );
    return { options: rows.map((r: any) => ({ value: r.value, label: String(r.label ?? r.value) })) };
  }
}
