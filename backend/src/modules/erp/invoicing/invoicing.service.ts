import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { TABLE_META } from '../../../table-meta';

/** 数值兜底：非数字按 0 处理 */
function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 开票业务类型 */
export type InvoiceKind = 'purchase' | 'sales';

/** 两张开票表 + 往来方字段映射 */
interface InvoiceTables {
  /** 主表（开票登记表） */
  head: string;
  /** 台账表（每次开票记录） */
  log: string;
  /** 往来方列（采购=suppliers_code，销售=customers_id） */
  partyField: string;
  /** 往来方名称解析子查询 */
  partyName: string;
}

/**
 * 开票登记服务
 *
 * 对齐原 kuyou 两个控制器：
 *  - Invoicing.php     采购开票（kuyou_invoicing / kuyou_invoicing_log）
 *  - SalesInvoicing.php 销货开票（kuyou_sales_invoicing / kuyou_sales_invoicing_log）
 *
 * 业务闭环（与 PHP 完全一致）：
 *  - 登记：选多条未开票/部分开票记录，填发票号与抬头，按每条输入的开票金额更新主表
 *    （pay_money 累加、give_money 扣减、invoice_status 置 1）并写入台账
 *  - 删除台账：回冲主表金额（pay_money 减、give_money 加、invoice_status 复位 0）
 *
 * 安全：表名/列名来自代码常量与 TABLE_META 白名单，用户输入一律参数化。
 */
@Injectable()
export class InvoicingService {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  /** 取某类开票的表映射 */
  private tables(kind: InvoiceKind): InvoiceTables {
    if (kind === 'purchase') {
      return {
        head: 'kuyou_invoicing',
        log: 'kuyou_invoicing_log',
        partyField: 'suppliers_code',
        partyName: '(SELECT s.supplyer_name FROM kuyou_suppliers s WHERE s.supplyer_code = t.suppliers_code LIMIT 1)',
      };
    }
    if (kind === 'sales') {
      return {
        head: 'kuyou_sales_invoicing',
        log: 'kuyou_sales_invoicing_log',
        partyField: 'customers_id',
        partyName: '(SELECT c.customer_name FROM kuyou_customers c WHERE c.id = t.customers_id LIMIT 1)',
      };
    }
    throw new BadRequestException('kind 仅支持 purchase / sales');
  }

  /** 校验表在白名单内 */
  private assertTable(table: string): void {
    if (!TABLE_META[table]) throw new BadRequestException(`表不存在或未授权: ${table}`);
  }

  /** 把秒级日期区间字符串转成时间戳（本地时区） */
  private toSeconds(v: string, endDay = false): number {
    const s = endDay && v.length === 10 ? `${v} 23:59:59` : v;
    const ms = Date.parse(s.replace(' ', 'T'));
    return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
  }

  /* ==================================================================
   * 列表：已登记 / 全部
   * ================================================================== */

  /**
   * 开票登记表列表
   * @param kind  purchase | sales
   * @param q    过滤条件：begin_time/end_time(日期), party(往来方编码/ID), bill_codes(单据号), keyword
   */
  async list(kind: InvoiceKind, q: any) {
    const t = this.tables(kind);
    this.assertTable(t.head);
    const begin = q?.begin_time ? this.toSeconds(String(q.begin_time)) : 0;
    const end = q?.end_time ? this.toSeconds(String(q.end_time), true) : 0;
    const party = String(q?.party || '').trim();
    const billCodes = String(q?.bill_codes || q?.keyword || '').trim();

    const wheres: string[] = [];
    const params: any[] = [];
    if (begin && end) {
      wheres.push('t.`bill_time` BETWEEN ? AND ?');
      params.push(begin, end);
    }
    if (party) {
      wheres.push(`t.\`${t.partyField}\` LIKE ?`);
      params.push(`%${party}%`);
    }
    if (billCodes) {
      wheres.push('t.`bill_codes` LIKE ?');
      params.push(`%${billCodes}%`);
    }
    const whereSql = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';

    const offset = Math.max(0, parseInt(String(q?.offset ?? 0), 10) || 0);
    const limit = Math.min(500, parseInt(String(q?.limit ?? 15), 10) || 15);

    const rows = await this.conn.query(
      `SELECT t.*, ${t.partyName} AS party_name FROM \`${t.head}\` t ${whereSql} ORDER BY t.\`id\` DESC LIMIT ?, ?`,
      [...params, offset, limit],
    );
    const totalRows = await this.conn.query(
      `SELECT COUNT(*) AS total FROM \`${t.head}\` t ${whereSql}`,
      params,
    );
    return { total: Number(totalRows[0]?.total || 0), rows };
  }

  /**
   * 待开票列表（invoice_status = 0）
   * @param kind purchase | sales
   */
  async pending(kind: InvoiceKind) {
    const t = this.tables(kind);
    this.assertTable(t.head);
    const rows = await this.conn.query(
      `SELECT t.*, ${t.partyName} AS party_name FROM \`${t.head}\` t WHERE t.\`invoice_status\` = '0' ORDER BY t.\`id\` DESC`,
    );
    return { total: rows.length, rows };
  }

  /**
   * 开票台账列表
   * @param kind purchase | sales
   * @param q    bill_codes / party 过滤
   */
  async logList(kind: InvoiceKind, q: any) {
    const t = this.tables(kind);
    this.assertTable(t.log);
    const party = String(q?.party || '').trim();
    const billCodes = String(q?.bill_codes || q?.keyword || '').trim();
    const wheres: string[] = [];
    const params: any[] = [];
    if (party) {
      wheres.push(`t.\`${t.partyField}\` LIKE ?`);
      params.push(`%${party}%`);
    }
    if (billCodes) {
      wheres.push('t.`bill_codes` LIKE ?');
      params.push(`%${billCodes}%`);
    }
    const whereSql = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
    const offset = Math.max(0, parseInt(String(q?.offset ?? 0), 10) || 0);
    const limit = Math.min(500, parseInt(String(q?.limit ?? 15), 10) || 15);
    const rows = await this.conn.query(
      `SELECT t.*, ${t.partyName} AS party_name FROM \`${t.log}\` t ${whereSql} ORDER BY t.\`id\` DESC LIMIT ?, ?`,
      [...params, offset, limit],
    );
    const totalRows = await this.conn.query(
      `SELECT COUNT(*) AS total FROM \`${t.log}\` t ${whereSql}`,
      params,
    );
    return { total: Number(totalRows[0]?.total || 0), rows };
  }

  /* ==================================================================
   * 登记：选多条记录 + 发票号 + 抬头
   * ================================================================== */

  /**
   * 开票登记
   *
   * 对齐 Invoicing.php add()：
   *  - 发票号(invoice) 与 抬头(invoice_header) 必填
   *  - 每条记录：invoice_status 已开时开票金额须 >0 且 ≤ 未开票；未开时须为数字且 >0
   *  - 事务内更新主表（pay_money 累加、give_money 扣减、invoice_status=1）并写入台账
   *
   * @param kind  purchase | sales
   * @param body.rows       [{ id, invoicing }]
   * @param body.invoice    发票号
   * @param body.invoice_header 发票抬头
   * @param user            当前用户
   */
  async register(kind: InvoiceKind, body: any, user?: any) {
    const t = this.tables(kind);
    this.assertTable(t.head);
    this.assertTable(t.log);

    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length) throw new BadRequestException('请选择需要开票的数据');
    const invoice = String(body?.invoice || '').trim();
    if (!invoice) throw new BadRequestException('请输入发票号');
    const invoiceHeader = String(body?.invoice_header || '').trim();
    if (!invoiceHeader) throw new BadRequestException('请输入发票抬头');

    const now = Math.floor(Date.now() / 1000);
    const adminId = user?.uid ?? user?.id ?? null;
    const headCols = TABLE_META[t.head].columns;
    const logCols = TABLE_META[t.log].columns;

    // 预取并校验全部待开票主表行
    const ids = rows.map((r: any) => parseInt(String(r.id), 10)).filter((v: number) => Number.isFinite(v) && v > 0);
    if (!ids.length) throw new BadRequestException('开票数据 id 非法');
    const idPlace = ids.map(() => '?').join(',');
    const heads = await this.conn.query(
      `SELECT * FROM \`${t.head}\` WHERE \`id\` IN (${idPlace})`,
      ids,
    );
    const headMap = new Map<number, any>(heads.map((h: any) => [h.id, h]));

    const logs: any[] = [];
    for (const r of rows) {
      const id = parseInt(String(r.id), 10);
      const head = headMap.get(id);
      if (!head) throw new NotFoundException(`开票数据查询错误：id=${id}`);
      const invoicing = num(r.invoicing);
      if (String(head.invoice_status) === '1') {
        if (invoicing <= 0) throw new BadRequestException('开票金额必须大于0');
        if (num(head.give_money) < invoicing) throw new BadRequestException('开票金额不可大于未开票金额');
      } else if (!invoicing || !Number.isFinite(invoicing)) {
        throw new BadRequestException(`${head.bill_codes} 请输入开票金额`);
      }
      // 主表更新值
      const newPay = num(head.pay_money) + invoicing;
      const newGive = num(head.give_money) - invoicing;
      // 台账快照（仅写入台账表实际存在的列）
      const logRow: any = {};
      for (const c of logCols) {
        if (c === 'id' || c === 'invoicing_id') continue;
        if (c === 'pay_money') logRow[c] = newPay;
        else if (c === 'give_money') logRow[c] = newGive;
        else if (c === 'createtime') logRow[c] = now;
        else if (c === 'times') logRow[c] = now;
        else if (c === 'invoice') logRow[c] = invoice;
        else if (c === 'invoice_header') logRow[c] = invoiceHeader;
        else logRow[c] = head[c];
      }
      logs.push({ id, newPay, newGive, logRow });
    }

    return this.conn.transaction(async (em) => {
      for (const l of logs) {
        await em.query(
          `UPDATE \`${t.head}\` SET \`invoice_status\` = '1', \`pay_money\` = ?, \`give_money\` = ?, \`invoice\` = ?, \`invoice_header\` = ?, \`times\` = ?, \`createtime\` = ? WHERE \`id\` = ?`,
          [l.newPay, l.newGive, invoice, invoiceHeader, now, now, l.id],
        );
        const cols = Object.keys(l.logRow).filter((c) => TABLE_META[t.log].columns.includes(c));
        await em.query(
          `INSERT INTO \`${t.log}\` (\`invoicing_id\`, ${cols.map((c) => `\`${c}\``).join(', ')}, \`createtime\`) VALUES (?, ${cols.map(() => '?').join(', ')}, ?)`,
          [l.id, ...cols.map((c) => l.logRow[c]), now],
        );
      }
      return { registered: logs.length, invoice };
    });
  }

  /* ==================================================================
   * 删除台账：回冲主表金额
   * ================================================================== */

  /**
   * 删除开票台账并回冲主表
   *
   * 对齐 Invoicing.php del()：
   *  - 取台账行的 pay_money（登记时的累计已开票额）
   *  - 主表 pay_money 减、give_money 加、invoice_status 复位 0
   *  - 删除该台账行
   *
   * @param kind purchase | sales
   * @param ids  台账主键数组
   */
  async removeLog(kind: InvoiceKind, ids: number[]) {
    const t = this.tables(kind);
    this.assertTable(t.head);
    this.assertTable(t.log);
    const clean = (ids || []).filter((v) => Number.isFinite(v) && v > 0);
    if (!clean.length) throw new BadRequestException('请选择要删除的台账记录');

    return this.conn.transaction(async (em) => {
      let removed = 0;
      for (const id of clean) {
        const logs = await em.query(`SELECT * FROM \`${t.log}\` WHERE \`id\` = ? LIMIT 1`, [id]);
        const log = logs[0];
        if (!log) continue;
        const heads = await em.query(`SELECT * FROM \`${t.head}\` WHERE \`id\` = ? LIMIT 1`, [log.invoicing_id]);
        const head = heads[0];
        if (head) {
          await em.query(
            `UPDATE \`${t.head}\` SET \`invoice_status\` = '0', \`pay_money\` = ?, \`give_money\` = ? WHERE \`id\` = ?`,
            [num(head.pay_money) - num(log.pay_money), num(head.give_money) + num(log.pay_money), log.invoicing_id],
          );
        }
        await em.query(`DELETE FROM \`${t.log}\` WHERE \`id\` = ?`, [id]);
        removed++;
      }
      return { removed };
    });
  }
}
