import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

/**
 * 系统辅助：操作日志查看 + 通用导出（导入由 import 模块负责）。
 */
@Injectable()
export class DataService {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  /** 操作日志列表 */
  async operateLog(limit = 200) {
    const rows: any[] = await this.conn.query(
      `SELECT * FROM kuyou_operate_log ORDER BY createtime DESC LIMIT ?`, [limit]);
    return { rows, total: rows.length };
  }

  /** 通用导出为 CSV */
  async export(table: string, limit = 500) {
    const allow = ['goods', 'customers', 'suppliers', 'staff_member', 'accounts', 'stocktake'];
    if (!allow.includes(table)) return { code: 0, msg: '该表不支持导出', allowed: allow };
    const rows: any[] = await this.conn.query(`SELECT * FROM kuyou_${table} LIMIT ?`, [limit]);
    const columns = rows.length ? Object.keys(rows[0]) : [];
    const csv = [
      columns.join(','),
      ...rows.map((r) => columns.map((c) => JSON.stringify(r[c] ?? '')).join(',')),
    ].join('\n');
    return { code: 1, rows, columns, csv };
  }
}
