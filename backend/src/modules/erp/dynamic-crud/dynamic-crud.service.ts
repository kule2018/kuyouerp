import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { TABLE_META, TableMeta } from '../../../table-meta';
import { getListEnricher } from './list-enrichers';
import { RbacService } from '../../rbac/rbac.service';

/**
 * buildparams 查询参数（对齐 FastAdmin 前端约定）
 * search     快速搜索关键字
 * filter     JSON 字符串，如 {"goods_name":"abc"}
 * op         JSON 字符串，如 {"goods_name":"like"}
 * sort/order 排序字段与方向
 * offset/limit 分页
 */
export interface QueryParams {
  search?: string;
  filter?: string;
  op?: string;
  sort?: string;
  order?: string;
  offset?: number | string;
  limit?: number | string;
  /**
   * 强制过滤条件（由服务端配置下发，不可被前端覆盖）。
   * 用于「同一物理表按业务标识拆成多个页面」的场景，如零售单与销货单共用
   * kuyou_goods_sales，靠 order_type=2 区分。此处的值优先于前端传入的同名列。
   */
  extraFilter?: Record<string, any>;
}

/** 安全解析 JSON 字符串（失败返回 {}） */
function safeParse(v: any): Record<string, any> {
  if (!v || typeof v !== 'string') return typeof v === 'object' && v ? v : {};
  try {
    const o = JSON.parse(v);
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

/**
 * 动态 CRUD 服务
 * 用原生 SQL 对任意 kuyou_ 表执行 增/删/改/查。
 * 表名与列名一律走 TABLE_META 白名单，取值全部参数化，杜绝 SQL 注入。
 * 返回的 rows 为数据库原始列名（snake_case），与原 FastAdmin `Db::name()->select()` 输出一致。
 */
@Injectable()
export class DynamicCrudService {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    private readonly rbac: RbacService,
  ) {}

  /** 校验表名在白名单内 */
  private meta(table: string): TableMeta {
    const m = TABLE_META[table];
    if (!m) throw new BadRequestException(`表不存在或未授权: ${table}`);
    return m;
  }

  /** 从候选字段中筛出真实存在的列（防止通过列名注入） */
  private validCols(table: string, fields: string[]): string[] {
    const set = new Set(this.meta(table).columns);
    return fields.filter((f) => set.has(f));
  }

  /** 组装 WHERE 条件片段（列名白名单 + 值参数化） */
  private buildWhere(
    table: string,
    q: QueryParams,
    sf?: { sql: string; params: any[] },
  ): { sql: string; params: any[] } {
    const m = this.meta(table);
    const where: string[] = [];
    const params: any[] = [];
    // 软删表：仅看未删除
    if (m.hasDt) where.push('`deletetime` IS NULL');

    // 强制过滤优先：覆盖前端同名列，防止绕过业务边界
    const filter = { ...safeParse(q.filter), ...(q.extraFilter || {}) };
    const op = safeParse(q.op);
    const colSet = new Set(m.columns);
    Object.keys(filter).forEach((field) => {
      if (!colSet.has(field)) return; // 忽略非法列
      let value = filter[field];
      const operator = String(op[field] || '=').toLowerCase();
      switch (operator) {
        case 'null':
          where.push(`\`${field}\` IS NULL`);
          return;
        case 'not null':
        case 'notnull':
          where.push(`\`${field}\` IS NOT NULL`);
          return;
        case 'in': {
          const arr = Array.isArray(value) ? value : String(value).split(',');
          if (!arr.length) return;
          where.push(`\`${field}\` IN (${arr.map(() => '?').join(',')})`);
          params.push(...arr);
          return;
        }
        case 'between': {
          const arr = Array.isArray(value) ? value : String(value).split(',');
          if (arr.length !== 2) return;
          where.push(`\`${field}\` BETWEEN ? AND ?`);
          params.push(arr[0], arr[1]);
          return;
        }
        case 'like':
        case 'not like':
          where.push(`\`${field}\` ${operator === 'like' ? 'LIKE' : 'NOT LIKE'} ?`);
          params.push(`%${value}%`);
          return;
        case '>': case '>=': case '<': case '<=': case '<>':
          where.push(`\`${field}\` ${operator} ?`);
          params.push(value);
          return;
        default:
          where.push(`\`${field}\` = ?`);
          params.push(value);
          return;
      }
    });

    // 快速搜索：对所有文本列 LIKE OR
    if (q.search) {
      const textCols = m.columns.filter((c) => {
        const t = (m.types[c] || '').toLowerCase();
        return !c.endsWith('time') &&
          (t.startsWith('varchar') || t.startsWith('char') || t.startsWith('text') || t.startsWith('enum'));
      });
      if (textCols.length) {
        where.push('(' + textCols.map((c) => `\`${c}\` LIKE ?`).join(' OR ') + ')');
        textCols.forEach(() => params.push(`%${q.search}%`));
      }
    }
    if (sf?.sql) {
      where.push(sf.sql);
      params.push(...sf.params);
    }
    return { sql: where.length ? ' WHERE ' + where.join(' AND ') : '', params };
  }

  /**
   * 数据权限：按角色授权仓库生成 store_id / stores_id 过滤片段。
   * 仅当角色 dataScope=custom 且目标表含仓库列时生效；超级管理员(roleId=0)与
   * dataScope=all 直接放行。返回 "" 表示不加过滤。
   */
  private async storeFilter(
    table: string,
    user: any,
  ): Promise<{ sql: string; params: any[] }> {
    if (!user || (user.roleId ?? 0) === 0) return { sql: '', params: [] };
    const scope = await this.rbac.getDataScope(user.roleId);
    if (scope.dataScope === 'all' || !scope.storeIds || !scope.storeIds.length) {
      return { sql: '', params: [] };
    }
    const cols: string[] = TABLE_META[table]?.columns || [];
    const col = cols.includes('store_id')
      ? 'store_id'
      : cols.includes('stores_id')
        ? 'stores_id'
        : null;
    if (!col) return { sql: '', params: [] };
    return {
      sql: `AND \`${col}\` IN (${scope.storeIds.map(() => '?').join(',')})`,
      params: scope.storeIds,
    };
  }

  /** 列表查询 index / selectpage */
  async list(table: string, q: QueryParams, user?: any): Promise<{ total: number; rows: any[] }> {
    const m = this.meta(table);
    const sf = await this.storeFilter(table, user);
    const { sql, params } = this.buildWhere(table, q, sf);

    // 排序（列名白名单）
    let orderSql = '';
    const sort = q.sort && m.columns.includes(q.sort) ? q.sort : m.pk;
    const order = String(q.order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    orderSql = ` ORDER BY \`${sort}\` ${order}`;

    const offset = Math.max(0, parseInt(String(q.offset ?? 0), 10) || 0);
    const limit = Math.min(1000, parseInt(String(q.limit ?? 15), 10) || 15);

    const rows = await this.conn.query(
      `SELECT * FROM \`${table}\`${sql}${orderSql} LIMIT ${offset}, ${limit}`,
      params,
    );
    const totalRow = await this.conn.query(
      `SELECT COUNT(*) AS total FROM \`${table}\`${sql}`,
      params,
    );
    // 列表富化：如用户订单按源逻辑联表展开商品行（未注册的表原样返回）
    const enricher = getListEnricher(table);
    const outRows = enricher ? await enricher(rows) : rows;
    return { total: Number(totalRow[0]?.total || 0), rows: outRows };
  }

  /** selectpage（供前端 select 下拉/表格，含 list 字段兼容原约定） */
  async selectpage(table: string, q: QueryParams, user?: any): Promise<{ total: number; rows: any[]; list: any[] }> {
    const res = await this.list(table, q, user);
    return { total: res.total, rows: res.rows, list: res.rows };
  }

  /** 单条查询（供 edit 回显） */
  async detail(table: string, id: number | string, user?: any): Promise<any> {
    const m = this.meta(table);
    const sf = await this.storeFilter(table, user);
    const rows = await this.conn.query(
      `SELECT * FROM \`${table}\` WHERE \`${m.pk}\` = ? ${sf.sql} LIMIT 1`,
      [id, ...sf.params],
    );
    return rows[0] || null;
  }

  /** 新增 */
  async add(table: string, body: Record<string, any>): Promise<any> {
    const m = this.meta(table);
    // 可写列：存在于表、且非自增主键、非自动维护字段
    const cols = this.validCols(table, Object.keys(body)).filter(
      (c) => !(m.auto && c === m.pk),
    );
    if (!cols.length) return { [m.pk]: 0 };
    const values = cols.map((c) => body[c]);
    const result = await this.conn.query(
      `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
      values,
    );
    // 商品：按源 Goods::add 生成四张子表（多单位价格 / 期初库存 / SKU 属性）
    if (table === 'kuyou_goods') await this.goodsAfterSave(result.insertId, body, false);
    return { [m.pk]: result.insertId };
  }

  /** 编辑 */
  async edit(table: string, body: Record<string, any>, user?: any): Promise<any> {
    const m = this.meta(table);
    const id = body[m.pk];
    if (id === undefined || id === null || id === '') {
      throw new BadRequestException('缺少主键 ' + m.pk);
    }
    const cols = this.validCols(table, Object.keys(body)).filter(
      (c) => c !== m.pk && !(m.auto && c === m.pk),
    );
    if (!cols.length) return { affected: 0 };
    const values = cols.map((c) => body[c]);
    const sf = await this.storeFilter(table, user);
    const result = await this.conn.query(
      `UPDATE \`${table}\` SET ${cols.map((c) => `\`${c}\` = ?`).join(',')} WHERE \`${m.pk}\` = ? ${sf.sql}`,
      [...values, id, ...sf.params],
    );
    // 商品：编辑时按源逻辑清空并重建对应子表
    if (table === 'kuyou_goods') await this.goodsAfterSave(id, body, true);
    return { affected: result.affectedRows };
  }

  /** 删除：软删表置 deletetime，否则物理删除 */
  async del(table: string, ids: string, user?: any): Promise<{ affected: number }> {
    const m = this.meta(table);
    const list = String(ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    if (!list.length) throw new BadRequestException('缺少待删除 id');
    const placeholders = list.map(() => '?').join(',');
    const sf = await this.storeFilter(table, user);
    let result: any;
    if (m.hasDt) {
      result = await this.conn.query(
        `UPDATE \`${table}\` SET \`deletetime\` = ? WHERE \`${m.pk}\` IN (${placeholders}) ${sf.sql}`,
        [Math.floor(Date.now() / 1000), ...list, ...sf.params],
      );
    } else {
      result = await this.conn.query(
        `DELETE FROM \`${table}\` WHERE \`${m.pk}\` IN (${placeholders}) ${sf.sql}`,
        [...list, ...sf.params],
      );
    }
    return { affected: result.affectedRows };
  }

  /**
   * 批量操作（对应 FastAdmin 通用 multi）
   * 整体思路：解析 params 中的待更新字段（形如 'status=1' 或 { status: 1 }），
   * 校验列合法后按主键批量 UPDATE；若 params 指定删除语义则转批量删除。
   *
   * @param table 表名
   * @param ids   逗号分隔的主键
   * @param params 形如 'status=1' 的字符串，或 { status: 1 } / { params: { status: 1 } } 对象
   */
  async multi(table: string, ids: string, params: any, user?: any): Promise<{ affected: number }> {
    const list = String(ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    if (!list.length) throw new BadRequestException('缺少待操作 id');

    // 归一化：支持 'field=value' 字符串、{ field: value }、{ params: 'field=value' }
    let kv: Record<string, any> = {};
    if (typeof params === 'string') {
      for (const seg of params.split('&')) {
        const [k, v] = seg.split('=');
        if (k) kv[k] = v;
      }
    } else if (params && typeof params === 'object') {
      const inner = params.params !== undefined ? params.params : params;
      if (typeof inner === 'string') {
        for (const seg of inner.split('&')) {
          const [k, v] = seg.split('=');
          if (k) kv[k] = v;
        }
      } else if (inner && typeof inner === 'object') {
        kv = { ...inner };
      }
    }
    // 剔除控制字段
    for (const k of ['ids', 'id', 'action', 'params']) delete kv[k];

    // 删除语义：action=del 或显式传 deletetime
    const isDel = String(params?.action || '') === 'del' || kv.deletetime !== undefined;
    if (isDel) return this.del(table, ids, user);

    const m = this.meta(table);
    const cols = this.validCols(table, Object.keys(kv)).filter((c) => c !== m.pk);
    if (!cols.length) throw new BadRequestException('缺少待更新字段');
    const placeholders = list.map(() => '?').join(',');
    const sf = await this.storeFilter(table, user);
    const setSql = cols.map((c) => `\`${c}\` = ?`).join(',');
    const result = await this.conn.query(
      `UPDATE \`${table}\` SET ${setSql} WHERE \`${m.pk}\` IN (${placeholders}) ${sf.sql}`,
      [...cols.map((c) => kv[c]), ...list, ...sf.params],
    );
    return { affected: result.affectedRows };
  }

  /** 空值判定（0 视为有值，仅 undefined/null/'' 为空） */
  private isEmpty(v: any): boolean {
    return v === undefined || v === null || v === '';
  }

  /**
   * 按对象键批量插入（列名走 TABLE_META 白名单，值全部参数化）。
   * 用于商品子表写入，避免硬编码列名导致表结构差异报错。
   */
  private async insertRows(table: string, rows: any[]): Promise<void> {
    if (!rows || !rows.length) return;
    const m = TABLE_META[table];
    if (!m) return;
    const keys = Object.keys(rows[0]).filter((k) => m.columns.includes(k));
    if (!keys.length) return;
    const colsSql = keys.map((c) => `\`${c}\``).join(',');
    for (const r of rows) {
      await this.conn.query(
        `INSERT INTO \`${table}\` (${colsSql}) VALUES (${keys.map(() => '?').join(',')})`,
        keys.map((k) => r[k]),
      );
    }
  }

  /**
   * 商品保存编排：生成四张子表（对齐源 Goods::add / Goods::edit）
   *
   * 源端保存商品时会按提交的「多单位价格 / 期初库存 / 辅助属性」额外写入
   * kuyou_goods_price、kuyou_goods_stock、kuyou_goods_period、kuyou_goods_attr，
   * 并在编辑时先清旧数据再重建。目标端通用 CRUD 此前只写主表，
   * 导致多单位取价、期初库存、SKU 属性数据缺失（源端有、目标端为空壳）。
   *
   * 设计要点（保证零回归 + 不误删数据）：
   * - 仅当 payload 携带对应子表数组时才处理，未携带时保持通用 CRUD 行为不变；
   * - 库存/期初仅在显式提交 stores_data 时重建，避免误删单据累计的真实库存；
   * - 价格表主表字段同步仅在前端未显式提交主表价格时执行。
   */
  private async goodsAfterSave(goodsId: number | string, body: Record<string, any>, isEdit: boolean): Promise<void> {
    const goodsPrice = Array.isArray(body.goods_price) ? body.goods_price : null;
    const storesData = Array.isArray(body.stores_data) ? body.stores_data : null;
    const attrPrice = Array.isArray(body.attr_price) ? body.attr_price : null;
    const goodsSerial = Array.isArray(body.goods_serial) ? body.goods_serial : null;
    const goodsBatch = Array.isArray(body.goods_batch) ? body.goods_batch : null;
    if (!goodsPrice && !storesData && !attrPrice && !goodsSerial && !goodsBatch) return;

    const now = Math.floor(Date.now() / 1000);
    let goodsCode = body.goods_code;
    if (this.isEmpty(goodsCode)) {
      const g = await this.conn.query('SELECT `goods_code` FROM `kuyou_goods` WHERE `id` = ? LIMIT 1', [goodsId]);
      goodsCode = g[0]?.goods_code;
    }
    if (this.isEmpty(goodsCode)) return;

    // 1) 多单位价格表（源：more_unit=1 时按单位逐行写，首个单位 is_default=1）
    if (goodsPrice && goodsPrice.length) {
      if (isEdit) await this.conn.query('DELETE FROM `kuyou_goods_price` WHERE `goods_code` = ?', [goodsCode]);
      await this.insertRows(
        'kuyou_goods_price',
        goodsPrice.map((r: any, i: number) => ({
          ...r,
          goods_id: goodsId,
          goods_code: r.goods_code ?? goodsCode,
          is_default: r.is_default ?? (i === 0 ? '1' : '0'),
          createtime: now,
          updatetime: now,
        })),
      );
      // 源 Goods.php 1034-1040：主表价格/单位取首个单位的值（仅在前端未显式提交时补）
      const first = goodsPrice[0] || {};
      const map: Record<string, string> = {
        market_sell_price: 'market_sell_price',
        wholesale_price: 'wholesale_price',
        vip_price: 'vip_price',
        discount: 'discount',
        discount2: 'discount2',
        purchase: 'purchase',
        unit_id: 'unit',
      };
      const sync: Record<string, any> = {};
      for (const [mainCol, srcKey] of Object.entries(map)) {
        if (this.isEmpty(body[mainCol]) && !this.isEmpty(first[srcKey])) sync[mainCol] = first[srcKey];
      }
      if (Object.keys(sync).length) {
        const setSql = Object.keys(sync).map((c) => `\`${c}\` = ?`).join(',');
        await this.conn.query(`UPDATE \`kuyou_goods\` SET ${setSql} WHERE \`id\` = ?`, [
          ...Object.values(sync),
          goodsId,
        ]);
      }
    }

    // 2) 期初库存（源：setqc=1 时 goods_stock 与 goods_period 同源写入）
    if (storesData && storesData.length) {
      if (isEdit) {
        await this.conn.query('DELETE FROM `kuyou_goods_stock` WHERE `goods_code` = ?', [goodsCode]);
        await this.conn.query('DELETE FROM `kuyou_goods_period` WHERE `goods_code` = ?', [goodsCode]);
      }
      const rows = storesData.map((r: any) => ({
        ...r,
        goods_id: goodsId,
        goods_code: r.goods_code ?? goodsCode,
        createtime: now,
        updatetime: now,
      }));
      await this.insertRows('kuyou_goods_stock', rows);
      await this.insertRows('kuyou_goods_period', rows);
    }

    // 3) 辅助属性 / SKU（源 877-921：按属性 ID 组合建 kuyou_aux_combination，再写 goods_attr）
    if (attrPrice && attrPrice.length) {
      if (isEdit) await this.conn.query('DELETE FROM `kuyou_goods_attr` WHERE `goods_code` = ?', [goodsCode]);
      const rows: any[] = [];
      for (const r of attrPrice) {
        let attributeId = r.attribute_id;
        if (this.isEmpty(attributeId) && !this.isEmpty(r.attr_ids)) {
          const ids = String(r.attr_ids).split('&').filter(Boolean).sort((a, b) => Number(a) - Number(b));
          const key = ids.join('&');
          const exist = (
            await this.conn.query('SELECT `id` FROM `kuyou_aux_combination` WHERE `attr_ids` = ? LIMIT 1', [key])
          )[0];
          if (exist) {
            attributeId = exist.id;
          } else {
            attributeId = (
              await this.conn.query(
                'INSERT INTO `kuyou_aux_combination` (`attr_ids`,`attr_code`,`createtime`,`updatetime`) VALUES (?,?,?,?)',
                [key, r.attr_code ?? '', now, now],
              )
            ).insertId;
          }
        }
        rows.push({
          ...r,
          goods_id: goodsId,
          goods_code: r.goods_code ?? goodsCode,
          attribute_id: attributeId ?? 0,
          createtime: now,
          updatetime: now,
        });
      }
      await this.insertRows('kuyou_goods_attr', rows);
    }

    // 4) 商品序列号期初登记（源 Goods.php 1142-1350：建档时登记 serial 并写 serial_log）
    // 目标端此前全仓无 INSERT kuyou_goods_serial，序列号只能销货出库时标记，
    // 缺入库登记与全程跟踪（源端有、目标端为空壳）。
    if (goodsSerial && goodsSerial.length) {
      if (isEdit) {
        await this.conn.query('DELETE FROM `kuyou_goods_serial` WHERE `goods_code` = ?', [goodsCode]);
        await this.conn.query('DELETE FROM `kuyou_goods_serial_log` WHERE `goods_id` = ?', [goodsId]);
      }
      const serialRows = goodsSerial.map((r: any) => ({
        ...r,
        goods_id: goodsId,
        goods_code: r.goods_code ?? goodsCode,
        status: r.status ?? '1',
        store_status: r.store_status ?? '1', // 1=在库
        createtime: now,
        updatetime: now,
      }));
      await this.insertRows('kuyou_goods_serial', serialRows);
      // serial_log：与源端一致登记期初流水（business_type 1=期初）
      await this.insertRows(
        'kuyou_goods_serial_log',
        serialRows.map((r: any) => ({
          goods_id: r.goods_id,
          stores_id: r.stores_id,
          attribute_id: r.attribute_id,
          serial: r.serial,
          business_type: '1', // 1=期初
          store_status: r.store_status ?? '1',
          remarks: r.remark ?? null,
          createtime: now,
          updatetime: now,
        })),
      );
    }

    // 5) 批次期初登记（源 Goods.php 1896-1930：建批次主档 → 批次库存 → 批次期初流水）
    // 源端在商品建档(setqc)且开启批次时，逐行建 kuyou_goods_batch 取得 batch_id，
    // 再写 kuyou_goods_batch_stock，并登记 business_type=1(期初) 的批次流水，
    // 其中 unit_price/tax_included 取单位成本、all_money/money_tax_price 取金额。
    // 目标端此前完全缺失该链路，开启批次的商品无批次主档与期初库存。
    if (goodsBatch && goodsBatch.length) {
      if (isEdit) {
        await this.conn.query('DELETE FROM `kuyou_goods_batch_stock` WHERE `goods_code` = ?', [goodsCode]);
        await this.conn.query('DELETE FROM `kuyou_goods_batch_log` WHERE `goods_id` = ? AND `business_type` = ?', [goodsId, '1']);
      }
      for (const b of goodsBatch) {
        const attrId = Number(b.attribute_id || 0);
        const qty = Number(b.stock || 0);
        const unitCost = Number(b.unit_cost || 0);
        const price = Number(b.price || 0);
        // 主档：剔除 stock/number/type/unit_cost/price（与源端 unset 一致）
        const master = await this.conn.query(
          'INSERT INTO `kuyou_goods_batch` (`admin_id`,`goods_id`,`goods_code`,`attribute_id`,`stores_id`,`batch_name`,`manufacture`,`guarantee`,`validity`,`address`,`registration`,`production`,`createtime`,`updatetime`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [
            b.admin_id ?? null,
            goodsId,
            b.goods_code ?? goodsCode,
            attrId,
            b.stores_id ?? 0,
            b.batch_name ?? null,
            b.manufacture ?? null,
            b.guarantee ?? null,
            b.validity ?? null,
            b.address ?? null,
            b.registration ?? null,
            b.production ?? null,
            now,
            now,
          ],
        );
        const batchId = master.insertId;
        await this.conn.query(
          'INSERT INTO `kuyou_goods_batch_stock` (`admin_id`,`batch_id`,`goods_id`,`goods_code`,`attribute_id`,`stores_id`,`stock`,`status`,`createtime`,`updatetime`) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [b.admin_id ?? null, batchId, goodsId, b.goods_code ?? goodsCode, attrId, b.stores_id ?? 0, qty, '1', now, now],
        );
        await this.conn.query(
          'INSERT INTO `kuyou_goods_batch_log` (`admin_id`,`goods_id`,`unit_price`,`tax_included`,`all_money`,`money_tax_price`,`goods_unit`,`stores_id`,`batch_id`,`number`,`business_type`,`order_id`,`createtime`,`updatetime`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [
            b.admin_id ?? null,
            goodsId,
            unitCost,
            unitCost,
            price,
            price,
            b.goods_unit ?? body.unit_id ?? null,
            b.stores_id ?? 0,
            batchId,
            qty,
            '1', // 1=期初余额
            goodsId,
            now,
            now,
          ],
        );
      }
    }
  }
}
