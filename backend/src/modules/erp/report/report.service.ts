import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { REPORTS, ReportDef } from './report.config';

/**
 * 通用报表引擎服务
 *
 * 整体思路：
 *  - 报表的 SELECT 片段来自固化配置（开发者可控），用户输入只出现在 WHERE 的参数位上
 *  - 动态拼接部分仅包含：表格名（白名单）、列片段（固化）、 ORDER BY / LIMIT（由白名单与整数校验）
 *  - 日期/时间条件：前端传 'YYYY-MM-DD' 字符串时按秒级时间戳比较（kuyou 时间列为 bigint）
 */
@Injectable()
export class ReportService {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  /** 取报表定义，未定义直接报错 */
  private def(key: string): ReportDef {
    const d = REPORTS.find((r) => r.key === key);
    if (!d) throw new BadRequestException(`报表未定义: ${key}`);
    return d;
  }

  /** 报表清单（供前端菜单渲染） */
  list() {
    return REPORTS.map((r) => ({
      key: r.key,
      title: r.title,
      group: r.group,
      columns: Object.keys(r.select),
      filters: r.filters,
    }));
  }

  /**
   * 执行报表查询
   * @param key    报表标识
   * @param params 前端传入的筛选参数
   * @returns { columns, rows, total, totals }
   */
  async run(
    key: string,
    params: Record<string, any> = {},
    offset = 0,
    limit = 50,
  ): Promise<{ columns: string[]; rows: any[]; total: number; totals: Record<string, number> }> {
    const d = this.def(key);
    const where: string[] = [];
    const bound: any[] = [];

    if (d.fixedWhere) where.push(`(${d.fixedWhere})`);

    // 逐项处理筛选：字段名由配置决定，取值一律参数化
    for (const f of d.filters) {
      const raw = params[f.name];
      if (raw === undefined || raw === null || raw === '') continue;
      const col = f.field || f.name;
      const op = f.op || '=';
      let value: any = raw;

      // 时间列（bigint 时间戳）：结束日期补到当日 23:59:59
      if (typeof value === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}( [0-9:]{8})?$/.test(value)) {
        value = this.toSeconds(value, op === '<=' && !value.includes(':'));
      } else if (op === 'LIKE') {
        value = `%${String(value)}%`;
      }
      where.push(`t.\`${col}\` ${op} ?`);
      bound.push(value);
    }

    const selectSql = Object.entries(d.select)
      .map(([alias, frag]) => `${frag} AS \`${alias}\``)
      .join(', ');
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    const groupSql = d.groupBy ? ` GROUP BY ${d.groupBy}` : '';
    const orderSql = d.orderBy ? ` ORDER BY ${d.orderBy}` : '';

    // 分页：先算总数再取当前页（聚合报表按结果行数计数）
    const countSql = d.groupBy
      ? `SELECT COUNT(*) AS total FROM (SELECT ${d.groupBy} FROM \`${d.from}\` t${whereSql}${groupSql}) c`
      : `SELECT COUNT(*) AS total FROM \`${d.from}\` t${whereSql}`;
    const countRow = await this.conn.query(countSql, bound);
    const total = Number(countRow[0]?.total || 0);

    const page = Math.max(0, Number(offset) || 0);
    const size = Math.min(1000, Number(limit) || 50);
    const rows = await this.conn.query(
      `SELECT ${selectSql} FROM \`${d.from}\` t${whereSql}${groupSql}${orderSql} LIMIT ${page}, ${size}`,
      bound,
    );

    // 数值列合计（前端表格页脚展示）
    const totals: Record<string, number> = {};
    for (const alias of Object.keys(d.select)) {
      const sum = rows.reduce((s, r) => {
        const v = Number(r[alias]);
        return Number.isFinite(v) ? s + v : s;
      }, 0);
      if (rows.some((r) => Number.isFinite(Number(r[alias])) && !Number.isNaN(Number(r[alias])))) {
        totals[alias] = Number(sum.toFixed(4));
      }
    }

    return { columns: Object.keys(d.select), rows, total, totals };
  }

  /**
   * 日期字符串转秒级时间戳
   * @param v       日期字符串
   * @param endOfDay 是否取当日 23:59:59（用于 <= 结束日期）
   */
  private toSeconds(v: string, endOfDay = false): number {
    // 注意：'YYYY-MM-DD' 单独解析会被当成 UTC，导致本地时间当天 0~8 点被漏掉，
    // 因此补齐时分秒再解析，确保按本地时区换算。
    let s = v;
    if (s.length === 10) s = endOfDay ? `${s} 23:59:59` : `${s} 00:00:00`;
    else if (endOfDay) s = `${s.slice(0, 10)} 23:59:59`;
    const ms = Date.parse(s.replace(' ', 'T'));
    return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
  }
}
