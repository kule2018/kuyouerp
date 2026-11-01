import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { TABLE_META } from '../../../table-meta';

/** 数值兜底：非数字一律按 0 处理 */
function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 按指定小数位四舍五入 */
function round(v: number, digits: number): number {
  const f = Math.pow(10, Math.max(0, Math.min(8, Number(digits) || 0)));
  return Math.round(v * f) / f;
}

/** 事务执行器 */
type Runner = (sql: string, params?: any[]) => Promise<any>;

/**
 * BOM（配方）业务服务
 *
 * 对齐原 kuyou `Bom.php` + `Procedure.php`：BOM 是嵌套主从结构
 *  - kuyou_bom（清单主表）           → 物料明细 kuyou_bom_info（procedure_id = 0）
 *  - kuyou_bom_procedure（工序主表）  → 工序物料 kuyou_bom_info（procedure_id = 工序id，bom_id = 所属清单）
 *  kuyou_bom_info 同时承载「清单直接物料」与「工序物料」，靠 procedure_id 区分。
 *  每次保存 / 删除后，按 bom_id 汇总 kuyou_bom_info 的 number / money 回填 kuyou_bom 合计。
 *
 * 安全：表名 / 列名来自 TABLE_META 白名单，用户输入一律参数化。
 */
@Injectable()
export class BomService {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  /* ---------------- 列校验工具（白名单防注入） ---------------- */
  private meta(table: string) {
    const m = TABLE_META[table];
    if (!m) throw new BadRequestException(`表不存在或未授权: ${table}`);
    return m;
  }
  private hasCol(table: string, col: string): boolean {
    return this.meta(table).columns.includes(col);
  }
  private validCols(table: string, cols: string[]): string[] {
    const allowed = new Set(this.meta(table).columns);
    return cols.filter((c) => allowed.has(c));
  }
  /** 数值列按类型转 number，空串按 0 */
  private normalizeRow(table: string, row: Record<string, any>) {
    const types: Record<string, string> = this.meta(table).types;
    const NUM = ['int', 'bigint', 'tinyint', 'smallint', 'mediumint', 'decimal', 'double', 'float', 'real', 'numeric'];
    for (const [k, v] of Object.entries(row)) {
      if (v === '' || v === null || v === undefined) continue;
      const base = (types[k] || '').toLowerCase().split('(')[0];
      if (NUM.includes(base)) row[k] = num(v);
    }
  }
  /** 生成单据编号：前缀 + 年月日 + 4 位随机 */
  private genCode(prefix: string): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `${prefix}${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${rand}`;
  }

  /** 回算清单合计：SUM(number) / SUM(money) 写入 kuyou_bom */
  private async recomputeBom(run: Runner, bomId: number) {
    const rows = await run(
      'SELECT SUM(`number`) AS number, SUM(`money`) AS money FROM `kuyou_bom_info` WHERE `bom_id` = ?',
      [bomId],
    );
    const number = round(num(rows[0]?.number), 4);
    const money = round(num(rows[0]?.money), 2);
    await run('UPDATE `kuyou_bom` SET `number` = ?, `all_money` = ? WHERE `id` = ?', [number, money, bomId]);
  }

  /* ==================================================================
   * BOM 清单（kuyou_bom + kuyou_bom_info[procedure_id=0]）
   * ================================================================== */

  /**
   * BOM 清单列表（分页 + 关键字）
   * @param params { page, limit, search }
   */
  async listBom(params: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(params.limit) || 15));
    const offset = (page - 1) * limit;
    const conds: string[] = [];
    const args: any[] = [];
    if (params.search) {
      conds.push('(`purchase_code` LIKE ? OR `name` LIKE ? OR `goods_name` LIKE ? OR `goods_code` LIKE ?)');
      args.push(`%${params.search}%`, `%${params.search}%`, `%${params.search}%`, `%${params.search}%`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const totalRows = await this.conn.query(`SELECT COUNT(*) AS c FROM \`kuyou_bom\` ${where}`, args);
    const total = Number(totalRows[0]?.c || 0);
    const rows = await this.conn.query(
      `SELECT * FROM \`kuyou_bom\` ${where} ORDER BY \`id\` DESC LIMIT ? OFFSET ?`,
      [...args, limit, offset],
    );
    return { total, rows };
  }

  /**
   * 取单条 BOM 清单 + 物料明细（procedure_id = 0）
   * @param id kuyou_bom.id
   */
  async getBom(id: number | string) {
    const headers = await this.conn.query('SELECT * FROM `kuyou_bom` WHERE `id` = ? LIMIT 1', [id]);
    const header = headers[0];
    if (!header) throw new NotFoundException('BOM 清单不存在');
    const materials = await this.conn.query(
      'SELECT * FROM `kuyou_bom_info` WHERE `bom_id` = ? AND (`procedure_id` IS NULL OR `procedure_id` = 0) ORDER BY `id` ASC',
      [id],
    );
    return { header, materials };
  }

  /**
   * 保存 BOM 清单（新增 / 编辑）
   * 整体思路：事务内落主表 → 删除该 bom 下的「直接物料」→ 逐行插入 → 回算合计。
   * @param body { header, materials }
   */
  async saveBom(body: { header?: Record<string, any>; materials?: any[] }) {
    const header = { ...(body?.header || {}) };
    const materials = Array.isArray(body?.materials) ? body.materials : [];
    if (!materials.length) throw new BadRequestException('请填写物料详情数据');

    const now = Math.floor(Date.now() / 1000);
    const m = this.meta('kuyou_bom');
    this.normalizeRow('kuyou_bom', header);

    return this.conn.transaction(async (em) => {
      const run: Runner = (sql, p = []) => em.query(sql, p);

      let id: any = header[m.pk];
      let mode: 'add' | 'edit' = 'add';
      if (id !== undefined && id !== null && id !== '') {
        mode = 'edit';
        // 编辑时若未回传单号，回读原单号（对齐 PHP：编辑保留原编号）
        if (!header['purchase_code']) {
          const cur = await run(`SELECT \`purchase_code\` FROM \`kuyou_bom\` WHERE \`id\` = ?`, [id]);
          header['purchase_code'] = cur[0]?.purchase_code || '';
        }
        const upCols = this.validCols('kuyou_bom', Object.keys(header)).filter((f) => f !== m.pk);
        if (upCols.length) {
          await run(
            `UPDATE \`kuyou_bom\` SET ${upCols.map((f) => `\`${f}\` = ?`).join(', ')}, \`updatetime\` = ? WHERE \`${m.pk}\` = ?`,
            [...upCols.map((f) => header[f]), now, id],
          );
        }
      } else {
        if (!header['purchase_code']) header['purchase_code'] = this.genCode('BOM');
        if (this.hasCol('kuyou_bom', 'createtime')) header['createtime'] = now;
        const cols = this.validCols('kuyou_bom', Object.keys(header));
        const ins = await run(
          `INSERT INTO \`kuyou_bom\` (${cols.map((f) => `\`${f}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          cols.map((f) => header[f]),
        );
        id = ins.insertId;
      }
      if (!header['purchase_code']) throw new BadRequestException('清单编号缺失');

      // 替换「直接物料」（procedure_id = 0）
      await run(
        'DELETE FROM `kuyou_bom_info` WHERE `bom_id` = ? AND (`procedure_id` IS NULL OR `procedure_id` = 0)',
        [id],
      );
      for (const raw of materials) {
        const line = { ...raw };
        this.normalizeRow('kuyou_bom_info', line);
        line['bom_id'] = id;
        line['procedure_id'] = 0;
        if (this.hasCol('kuyou_bom_info', 'createtime')) line['createtime'] = now;
        if (this.hasCol('kuyou_bom_info', 'updatetime')) line['updatetime'] = now;
        const cols = this.validCols('kuyou_bom_info', Object.keys(line));
        if (!cols.length) continue;
        await run(
          `INSERT INTO \`kuyou_bom_info\` (${cols.map((f) => `\`${f}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          cols.map((f) => line[f]),
        );
      }
      await this.recomputeBom(run, id as number);
      return { id, code: header['purchase_code'], mode };
    });
  }

  /**
   * 删除 BOM 清单（级联删除其全部物料 + 工序 + 工序物料）
   * @param id kuyou_bom.id
   */
  async delBom(id: number | string) {
    const headers = await this.conn.query('SELECT * FROM `kuyou_bom` WHERE `id` = ? LIMIT 1', [id]);
    if (!headers[0]) throw new NotFoundException('BOM 清单不存在');
    await this.conn.transaction(async (em) => {
      const run: Runner = (sql, p = []) => em.query(sql, p);
      const procs = await run('SELECT `id` FROM `kuyou_bom_procedure` WHERE `bom_id` = ?', [id]);
      for (const p of procs) {
        await run('DELETE FROM `kuyou_bom_info` WHERE `procedure_id` = ?', [p.id]);
      }
      await run('DELETE FROM `kuyou_bom_procedure` WHERE `bom_id` = ?', [id]);
      await run('DELETE FROM `kuyou_bom_info` WHERE `bom_id` = ?', [id]);
      await run('DELETE FROM `kuyou_bom` WHERE `id` = ?', [id]);
    });
    return { id };
  }

  /* ==================================================================
   * BOM 工序（kuyou_bom_procedure + kuyou_bom_info[procedure_id]）
   * ================================================================== */

  /**
   * 工序列表（按 bom_id 过滤，富化车间名称）
   * @param params { bomId, search }
   */
  async listProcedure(params: { bomId?: number | string; search?: string }) {
    const conds: string[] = [];
    const args: any[] = [];
    if (params.bomId) {
      conds.push('`bom_id` = ?');
      args.push(params.bomId);
    }
    if (params.search) {
      conds.push('(`purchase_code` LIKE ? OR `name` LIKE ?)');
      args.push(`%${params.search}%`, `%${params.search}%`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = await this.conn.query(
      `SELECT p.*, (SELECT w.name FROM \`kuyou_workshop\` w WHERE w.id = p.workshop_id LIMIT 1) AS workshop_name
       FROM \`kuyou_bom_procedure\` p ${where} ORDER BY p.\`id\` DESC`,
      args,
    );
    return { rows };
  }

  /**
   * 取单条工序 + 工序物料明细
   * @param id kuyou_bom_procedure.id
   */
  async getProcedure(id: number | string) {
    const headers = await this.conn.query('SELECT * FROM `kuyou_bom_procedure` WHERE `id` = ? LIMIT 1', [id]);
    const header = headers[0];
    if (!header) throw new NotFoundException('工序不存在');
    const materials = await this.conn.query(
      'SELECT * FROM `kuyou_bom_info` WHERE `procedure_id` = ? ORDER BY `id` ASC',
      [id],
    );
    return { header, materials };
  }

  /**
   * 保存工序（新增 / 编辑）
   * 整体思路：落工序主表 → 删除该工序下物料 → 逐行插入（带 bom_id） → 回算所属清单合计。
   * @param body { header, materials }
   */
  async saveProcedure(body: { header?: Record<string, any>; materials?: any[] }) {
    const header = { ...(body?.header || {}) };
    const materials = Array.isArray(body?.materials) ? body.materials : [];
    if (!materials.length) throw new BadRequestException('请填写工序物料详情数据');
    if (!header['bom_id']) throw new BadRequestException('工序必须归属某个 BOM 清单');

    const now = Math.floor(Date.now() / 1000);
    const m = this.meta('kuyou_bom_procedure');
    this.normalizeRow('kuyou_bom_procedure', header);

    return this.conn.transaction(async (em) => {
      const run: Runner = (sql, p = []) => em.query(sql, p);

      let id: any = header[m.pk];
      let mode: 'add' | 'edit' = 'add';
      if (id !== undefined && id !== null && id !== '') {
        mode = 'edit';
        // 编辑时若未回传单号，回读原单号
        if (!header['purchase_code']) {
          const cur = await run(`SELECT \`purchase_code\` FROM \`kuyou_bom_procedure\` WHERE \`id\` = ?`, [id]);
          header['purchase_code'] = cur[0]?.purchase_code || '';
        }
        const upCols = this.validCols('kuyou_bom_procedure', Object.keys(header)).filter((f) => f !== m.pk);
        if (upCols.length) {
          await run(
            `UPDATE \`kuyou_bom_procedure\` SET ${upCols.map((f) => `\`${f}\` = ?`).join(', ')}, \`updatetime\` = ? WHERE \`${m.pk}\` = ?`,
            [...upCols.map((f) => header[f]), now, id],
          );
        }
      } else {
        if (!header['purchase_code']) header['purchase_code'] = this.genCode('GX');
        if (this.hasCol('kuyou_bom_procedure', 'createtime')) header['createtime'] = now;
        const cols = this.validCols('kuyou_bom_procedure', Object.keys(header));
        const ins = await run(
          `INSERT INTO \`kuyou_bom_procedure\` (${cols.map((f) => `\`${f}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          cols.map((f) => header[f]),
        );
        id = ins.insertId;
      }
      if (!header['purchase_code']) throw new BadRequestException('工序编号缺失');

      await run('DELETE FROM `kuyou_bom_info` WHERE `procedure_id` = ?', [id]);
      for (const raw of materials) {
        const line = { ...raw };
        this.normalizeRow('kuyou_bom_info', line);
        line['procedure_id'] = id;
        line['bom_id'] = header['bom_id'];
        if (this.hasCol('kuyou_bom_info', 'createtime')) line['createtime'] = now;
        if (this.hasCol('kuyou_bom_info', 'updatetime')) line['updatetime'] = now;
        const cols = this.validCols('kuyou_bom_info', Object.keys(line));
        if (!cols.length) continue;
        await run(
          `INSERT INTO \`kuyou_bom_info\` (${cols.map((f) => `\`${f}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          cols.map((f) => line[f]),
        );
      }
      await this.recomputeBom(run, Number(header['bom_id']));
      return { id, code: header['purchase_code'], mode };
    });
  }

  /**
   * 删除工序（级联删除其物料 + 回算所属清单合计）
   * @param id kuyou_bom_procedure.id
   */
  async delProcedure(id: number | string) {
    const headers = await this.conn.query('SELECT * FROM `kuyou_bom_procedure` WHERE `id` = ? LIMIT 1', [id]);
    const header = headers[0];
    if (!header) throw new NotFoundException('工序不存在');
    const bomId = header['bom_id'];
    await this.conn.transaction(async (em) => {
      const run: Runner = (sql, p = []) => em.query(sql, p);
      await run('DELETE FROM `kuyou_bom_info` WHERE `procedure_id` = ?', [id]);
      await run('DELETE FROM `kuyou_bom_procedure` WHERE `id` = ?', [id]);
      await this.recomputeBom(run, Number(bomId));
    });
    return { id };
  }
}
