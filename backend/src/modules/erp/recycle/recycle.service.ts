import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

/**
 * 回收站服务（对应 FastAdmin Backend 的 recyclebin / restore / destroy）
 *
 * 源系统使用 SoftDelete 软删除，删除即置 deletetime 时间戳：
 * - recyclebin 列表：deletetime IS NOT NULL 的行
 * - restore 还原：deletetime 置回 NULL
 * - destroy 彻底删除：物理 DELETE（suppliers 会级联清理 kuyou_suppliers_user）
 *
 * 仅对源模型中启用 SoftDelete 的表开放（白名单），其余表拒绝，防止误删。
 */

/**
 * 支持回收站的表：以数据库实际含有 deletetime 软删字段的 kuyou_* 表为准
 * （已通过 information_schema 核对，避免白名单与实际表结构不一致导致
 *  「Unknown column 'deletetime'」或「该数据不支持回收站」）。
 */
const RECYCLE_TABLES = [
  'kuyou_accounts',
  'kuyou_accounts_log',
  'kuyou_customers_user',
  'kuyou_factory_user',
  'kuyou_goods',
  'kuyou_goods_period',
  'kuyou_goods_price',
  'kuyou_goods_stock',
  'kuyou_settlementtype',
  'kuyou_suppliers_user',
  'kuyou_transfers',
  'kuyou_user',
  'kuyou_user_order',
];

/** 彻底删除时的级联清理：主表 → 按字段清理子表 */
const CASCADE: Record<string, { table: string; field: string; by: string }[]> = {
  kuyou_suppliers: [{ table: 'kuyou_suppliers_user', field: 'supplyer_code', by: 'supplyer_code' }],
};

@Injectable()
export class RecycleService {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  /** 执行查询（表名均为白名单硬编码，取值参数化） */
  query(sql: string, params: any[] = []) {
    return this.conn.query(sql, params);
  }

  /** 校验表是否支持回收站，返回表名（防注入） */
  private guard(table: string): string {
    const t = String(table || '').startsWith('kuyou_') ? table : `kuyou_${table}`;
    if (RECYCLE_TABLES.indexOf(t) < 0) throw new BadRequestException('该数据不支持回收站');
    return t;
  }

  /**
   * 回收站列表
   * @param table 表名（可省略 kuyou_ 前缀）
   * @param page  页码
   * @param limit 每页条数
   * @returns { total, rows } layui 表格结构
   */
  async list(table: string, page = 1, limit = 20, sort = 'id', order = 'DESC') {
    const t = this.guard(table);
    const safeSort = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(sort) ? sort : 'id';
    const safeOrder = String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const total =
      (await this.query(`SELECT COUNT(*) AS \`total\` FROM \`${t}\` WHERE \`deletetime\` IS NOT NULL`))[0]?.total || 0;
    const rows = await this.query(
      `SELECT * FROM \`${t}\` WHERE \`deletetime\` IS NOT NULL ORDER BY \`${safeSort}\` ${safeOrder} LIMIT ? OFFSET ?`,
      [Number(limit), (Number(page) - 1) * Number(limit)],
    );
    return { total, rows };
  }

  /**
   * 还原：把 deletetime 置回 NULL
   * @param ids 逗号分隔的主键
   */
  async restore(table: string, ids: string) {
    const t = this.guard(table);
    const list = this.idList(ids);
    const result = await this.query(
      `UPDATE \`${t}\` SET \`deletetime\` = NULL WHERE \`id\` IN (${list.map(() => '?').join(',')})`,
      list,
    );
    return { affected: result.affectedRows };
  }

  /**
   * 彻底删除：物理 DELETE，并按级联规则清理关联子表
   */
  async destroy(table: string, ids: string) {
    const t = this.guard(table);
    const list = this.idList(ids);
    // 级联：先取待删行的关联字段值，再清理子表（源 suppliers 清理 suppliers_user）
    const rules = CASCADE[t];
    if (rules && rules.length) {
      const rows = await this.query(`SELECT * FROM \`${t}\` WHERE \`id\` IN (${list.map(() => '?').join(',')})`, list);
      for (const rule of rules) {
        const values = rows.map((r: any) => r[rule.by]).filter((v: any) => v !== undefined && v !== null && v !== '');
        if (values.length) {
          await this.query(
            `DELETE FROM \`${rule.table}\` WHERE \`${rule.field}\` IN (${values.map(() => '?').join(',')})`,
            values,
          );
        }
      }
    }
    const result = await this.query(`DELETE FROM \`${t}\` WHERE \`id\` IN (${list.map(() => '?').join(',')})`, list);
    if (!result.affectedRows) throw new BadRequestException('未删除任何数据');
    return { affected: result.affectedRows };
  }

  /** 逗号分隔 id → 数组，空则抛错 */
  private idList(ids: string): string[] {
    const list = String(ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    if (!list.length) throw new BadRequestException('缺少待操作 id');
    return list;
  }
}
