import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, EntityManager } from 'typeorm';
import { TABLE_META } from '../../../table-meta';
import { DOCUMENT_CONFIGS, DocumentConfig, detailLinkOf } from './document.config';
import { DocumentFinanceService } from './document.finance';

/** 主从单据请求体：header 为主表字段，lines 为明细行数组 */
export interface SaveDocBody {
  header: Record<string, any>;
  lines: Record<string, any>[];
}

/** 统一 SQL 执行签名（事务内外一致），便于隔离单测替换 */
type Runner = (sql: string, params?: any[]) => Promise<any>;

/**
 * 通用单据引擎服务
 *
 * 一套事务逻辑覆盖全部 kuyou 业务单据：
 *  1) docDetail ：主表 + 明细行一次性读出（编辑回显）
 *  2) saveDoc   ：事务内保存主表，并按「先删后插」整体替换明细行
 *  3) audit     ：审核 / 反审核事务；仓库类单据同步增减库存，调拨单按双仓转移
 *
 * 安全：表名 / 列名全部经 TABLE_META 白名单校验，取值一律参数化。
 * 明细关联支持三种模式，见 document.config.ts 的 detailLinkOf。
 */
@Injectable()
export class DocumentService {
  /** 审核财务联动（欠款 / 账户 / 流水 / 开票 / 核销），无状态可直接实例化 */
  private readonly finance = new DocumentFinanceService();

  constructor(@InjectConnection() private readonly conn: Connection) {}

  /** 取单据配置；未注册的单据表直接报错（避免被当成普通 CRUD 表处理） */
  private cfg(table: string): DocumentConfig {
    const c = DOCUMENT_CONFIGS[table];
    if (!c) throw new BadRequestException(`单据未注册: ${table}`);
    return c;
  }

  /** 取表元数据；表不存在时抛错 */
  private meta(table: string) {
    const m = TABLE_META[table];
    if (!m) throw new BadRequestException(`表不存在: ${table}`);
    return m;
  }

  /** 列存在判定（用于可选列如 examine_time / examine_id 的安全写入） */
  private hasCol(table: string, col: string): boolean {
    return (TABLE_META[table]?.columns || []).includes(col);
  }

  /** 列白名单过滤：只保留真实存在的列 */
  private validCols(table: string, fields: string[]): string[] {
    const set = new Set(TABLE_META[table]?.columns || []);
    return fields.filter((f) => set.has(f));
  }

  /**
   * 值规整：数据库 *_time 列为 int 时间戳，前端传 'YYYY-MM-DD HH:mm:ss' 字符串时转秒级时间戳
   * @param table 表名（用于取列类型）
   * @param row   一行数据（原地转换）
   */
  private normalizeRow(table: string, row: Record<string, any>) {
    const types = TABLE_META[table]?.types || {};
    for (const k of Object.keys(row)) {
      const t = (types[k] || '').toLowerCase();
      const v = row[k];
      // int / bigint / smallint / tinyint 的时间戳列都要识别（kuyou 多用 bigint(16)）
      if (/^(int|bigint|smallint|tinyint|mediumint)/.test(t) && /time$/.test(k) && typeof v === 'string' && v.includes('-')) {
        const ms = Date.parse(v.replace(' ', 'T'));
        row[k] = Number.isNaN(ms) ? Math.floor(Date.now() / 1000) : Math.floor(ms / 1000);
      }
    }
  }

  /** 生成单据编号：前缀 + yyyyMMdd + 4 位随机数 */
  private genCode(prefix: string): string {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `${prefix}${ymd}${rand}`;
  }

  /**
   * 单据详情：主表 + 明细行
   * @param table 主表名
   * @param id    主表主键
   * @returns { header, lines }
   */
  async docDetail(table: string, id: number | string) {
    const c = this.cfg(table);
    const hm = this.meta(c.header);
    const headers = await this.conn.query(
      `SELECT * FROM \`${c.header}\` WHERE \`${hm.pk}\` = ? LIMIT 1`,
      [id],
    );
    const header = headers[0];
    if (!header) throw new NotFoundException('单据不存在');

    let lines: any[] = [];
    if (c.detail) {
      const link = detailLinkOf(c);
      lines = await this.conn.query(
        `SELECT * FROM \`${c.detail}\` WHERE \`${link.detailField}\` = ? ORDER BY \`id\` ASC`,
        [header[link.headerField]],
      );
    }
    return { header, lines };
  }

  /**
   * 订货单转销货单预取（源 GoodsSales::add 的 order_id 分支）
   * 按用户订单带出客户、收货地址与商品明细，前端打开销货单新增页即自动填充。
   * @param orderId 用户订单主键（kuyou_user_order.id）
   * @returns { header: 预填表头, lines: 预填明细行 }
   */
  async prefillFromOrder(orderId: number | string) {
    const order = (
      await this.conn.query('SELECT * FROM `kuyou_user_order` WHERE `id` = ? LIMIT 1', [orderId])
    )[0];
    if (!order) throw new NotFoundException('订货单不存在');
    // 客户：订货单 user_id → kuyou_user.customers_id → kuyou_customers
    const user = (await this.conn.query('SELECT `customers_id` FROM `kuyou_user` WHERE `id` = ?', [order.user_id]))[0];
    const customersId = user?.customers_id ?? null;
    const customers = customersId
      ? (await this.conn.query('SELECT `id`, `customer_name` FROM `kuyou_customers` WHERE `id` = ?', [customersId]))[0]
      : null;
    // 明细：订货单商品行 → 商品档案 + 单位换算进率
    const goodsList = await this.conn.query('SELECT * FROM `kuyou_user_orderinfo` WHERE `order_id` = ? ORDER BY `id` ASC', [
      order.id,
    ]);
    const lines: any[] = [];
    for (const g of goodsList) {
      const goods = (await this.conn.query('SELECT * FROM `kuyou_goods` WHERE `id` = ? LIMIT 1', [g.goods_id]))[0];
      if (!goods) continue;
      // 辅单位换算进率：主单位 → 该行的下单单位；主单位自身为 1
      let basicNmber = 1;
      if (Number(g.goods_unit) !== Number(goods.unit_id)) {
        const conv = (
          await this.conn.query(
            'SELECT `advance_rate` FROM `kuyou_unit_conversion` WHERE `main_unit` = ? AND `vice_unit` = ?',
            [goods.unit_id, g.goods_unit],
          )
        )[0];
        basicNmber = Number(conv?.advance_rate) || 1;
      }
      lines.push({
        goods_code: goods.goods_code,
        goods_name: g.goods_name || goods.goods_name,
        goods_attr: g.goods_attr ?? '',
        goods_unit: g.goods_unit,
        unit_name: g.unit_name || '',
        attr_name: g.attr_name || '',
        stores_id: goods.manager_warehouse_id ?? '',
        allow_stock: goods.inventory ?? 0,
        number: g.number,
        purchase_number: g.number,
        default_unit: goods.unit_id,
        basic_nmber: this.round2(Number(g.number) * basicNmber),
        unit_price: g.price,
        tax_included: g.price,
        discount: 0,
        dis_money: 0,
        all_money: g.money,
        tax_rate: 0,
        tax_money: 0,
        money_tax_price: g.money,
        remark: '',
        // 关联回写用：保存时把该行与订货单明细绑定（kuyou_user_ordersaleinfo）
        user_order_info_id: g.id,
      });
    }
    return {
      header: {
        customers_id: customersId,
        customer_name: customers?.customer_name ?? '',
        receiving_address: order.address ?? '',
        real_money: order.order_price ?? 0,
        order_id: order.id,
      },
      lines,
    };
  }

  /** 两位小数规整（金额/数量展示口径） */
  private round2(v: number): number {
    return Math.round((Number(v) || 0) * 100) / 100;
  }

  /**
   * 按客户等级解析销售单价（源 Goods.php::getGoodsInfo 的价格选择逻辑）。
   * 等级：1零售(market_sell_price) / 2批发(wholesale_price) / 3会员(vip_price) /
   *       4零售×discount / 5零售×discount2；其余默认零售价。
   * 取 kuyou_goods_price 中匹配 unit 的行（无则取默认单位行）。
   * @returns 单价；商品无价格表时返回 null（交由原明细值不变）
   */
  private async resolveSaleUnitPrice(goodsId: any, unit: any, level: number): Promise<number | null> {
    const rows = await this.conn.query(
      'SELECT `unit`,`is_default`,`market_sell_price`,`wholesale_price`,`vip_price`,`discount`,`discount2` FROM `kuyou_goods_price` WHERE `goods_id` = ?',
      [goodsId],
    );
    if (!Array.isArray(rows) || !rows.length) return null;
    const r =
      rows.find((x: any) => Number(x.unit) === Number(unit)) ||
      rows.find((x: any) => String(x.is_default) === '1') ||
      rows[0];
    const field = level === 2 ? 'wholesale_price' : level === 3 ? 'vip_price' : 'market_sell_price';
    let price = Number(r[field] || 0);
    if (level === 4 && Number(r.discount) > 0) price = Math.round((price * Number(r.discount)) / 100 * 1e4) / 1e4;
    if (level === 5 && Number(r.discount2) > 0) price = Math.round((price * Number(r.discount2)) / 100 * 1e4) / 1e4;
    return price;
  }

  /** 空值判定（undefined / null / 空串均视为未传） */
  private emptyVal(v: any): boolean {
    return v === undefined || v === null || v === '';
  }

  /**
   * 保存单据（新增 / 编辑）
   * 整体思路：一个事务内先把主表落库拿到单号，再用「先删除该单号下的全部明细、再逐行插入」
   * 的方式整体替换明细行，保证主表明细始终一致，不会出现孤儿行。
   * @param table 主表名
   * @param body  { header, lines }
   * @param user  当前登录用户（写入 admin_id / 制单人）
   * @returns { id, code, mode }
   */
  async saveDoc(table: string, body: SaveDocBody, user: any) {
    const c = this.cfg(table);
    const hm = this.meta(c.header);
    const link = detailLinkOf(c);
    const header = { ...(body?.header || {}) };
    const lines = Array.isArray(body?.lines) ? body.lines : [];
    // 业务固定字段（如零售单 order_type=2）强制写入，前端不可覆盖
    if (c.fixedFilter) {
      for (const [k, v] of Object.entries(c.fixedFilter)) {
        if (this.hasCol(c.header, k)) header[k] = v;
      }
    }
    this.normalizeRow(c.header, header);

    const now = Math.floor(Date.now() / 1000);
    const adminId = user?.uid ?? user?.id ?? null;

    return this.conn.transaction(async (em) => {
      const run: Runner = (sql, params = []) => em.query(sql, params);

      // 1) 主表：带主键 = 编辑；否则新增并自动补单号
      let id = header[hm.pk];
      let mode: 'add' | 'edit' = 'add';
      if (id !== undefined && id !== null && id !== '') {
        mode = 'edit';
        const upCols = this.validCols(c.header, Object.keys(header)).filter((f) => f !== hm.pk);
        if (upCols.length) {
          await run(
            `UPDATE \`${c.header}\` SET ${upCols.map((f) => `\`${f}\` = ?`).join(', ')}, \`updatetime\` = ? WHERE \`${hm.pk}\` = ?`,
            [...upCols.map((f) => header[f]), now, id],
          );
        }
        const cur = await run(`SELECT \`${link.headerField}\` FROM \`${c.header}\` WHERE \`${hm.pk}\` = ?`, [id]);
        header[link.headerField] = cur[0]?.[link.headerField] ?? header[link.headerField];
      } else {
        if (!header[c.codeField]) header[c.codeField] = this.genCode(c.prefix);
        if (this.hasCol(c.header, 'admin_id')) header['admin_id'] = adminId;
        if (this.hasCol(c.header, 'preparation_id')) header['preparation_id'] = adminId;
        if (this.hasCol(c.header, 'createtime')) header['createtime'] = now;
        const cols = this.validCols(c.header, Object.keys(header));
        const ins = await run(
          `INSERT INTO \`${c.header}\` (${cols.map((f) => `\`${f}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          cols.map((f) => header[f]),
        );
        id = ins.insertId;
      }
      if (!header[c.codeField]) throw new BadRequestException('单据编号缺失');

      // 外键关联模式下关联值可能只有主表主键（新增后才有 id）
      const linkValue = (detailLinkOf(c).headerField === hm.pk ? id : header[link.headerField]) ?? id;

      // 客户等级价（仅销售类单据：表头带 customers_id）。源端 Goods.php::getGoodsInfo
      // 按 customerlevel_id 从 kuyou_goods_price 选价格字段（1零售/2批发/3会员，4·5零售×折扣），
      // ERP 建单服务端自动套用；目标端此前仅在商城/零售路径实现，ERP 建单缺失 → 补上。
      const isSalesDoc = this.hasCol(c.header, 'customers_id');
      let priceLevel = 1;
      if (isSalesDoc && header['customers_id']) {
        const custRow = (await run('SELECT `customerlevel_id` FROM `kuyou_customers` WHERE `id` = ?', [header['customers_id']]))[0];
        priceLevel = Number(custRow?.customerlevel_id || 1);
      }

      // 2) 明细行：整体替换（先按关联键删除，再逐行插入）
      if (c.detail) {
        await run(`DELETE FROM \`${c.detail}\` WHERE \`${link.detailField}\` = ?`, [linkValue]);
        // 订货单转销货单：收集明细自增 ID，用于回写 kuyou_user_ordersaleinfo
        const orderInfoLinks: { infoId: any; salesInfoId: any }[] = [];
        for (const raw of lines) {
          const line = { ...raw };
          this.normalizeRow(c.detail, line);
          line[link.detailField] = linkValue;
          if (this.hasCol(c.detail, c.codeField)) line[c.codeField] = header[c.codeField];
          // 明细行同步业务标识（如零售明细的 order_type）
          if (c.fixedFilter) {
            for (const [k, v] of Object.entries(c.fixedFilter)) {
              if (this.hasCol(c.detail, k)) line[k] = v;
            }
          }
          if (this.hasCol(c.detail, 'admin_id')) line['admin_id'] = adminId;
          if (this.hasCol(c.detail, 'createtime')) line['createtime'] = now;
          this.normalizeRow(c.detail, line);
          // 销售单据按客户等级套用多单位价格（与源端 getGoodsInfo 一致）
          if (isSalesDoc && line['goods_id'] && line['goods_unit']) {
            const lvlPrice = await this.resolveSaleUnitPrice(line['goods_id'], line['goods_unit'], priceLevel);
            if (lvlPrice !== null) {
              const number = Number(line.number || 0);
              const discount = Number(line.discount || 0);
              line.unit_price = lvlPrice;
              line.tax_included = lvlPrice;
              line.dis_money = this.round2((lvlPrice * number * discount) / 100);
              line.all_money = this.round2(lvlPrice * number - line.dis_money);
              line.money_tax_price = line.all_money;
            }
          }
          // 订货单明细关联列不属于明细表结构，插入前摘出
          const orderInfoId = line['user_order_info_id'];
          delete line['user_order_info_id'];
          const cols = this.validCols(c.detail, Object.keys(line));
          if (!cols.length) continue;
          const ins = await run(
            `INSERT INTO \`${c.detail}\` (${cols.map((f) => `\`${f}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
            cols.map((f) => line[f]),
          );
          if (orderInfoId !== undefined && orderInfoId !== null && orderInfoId !== '') {
            orderInfoLinks.push({ infoId: orderInfoId, salesInfoId: ins.insertId });
          }
        }
        // 订货单转销货单：写 订货单↔销货单 关联（源 GoodsSales::add 的 order_id 分支）
        if (mode === 'add' && !this.emptyVal(header['order_id'])) {
          await run('INSERT INTO `kuyou_user_ordersale` (`order_id`, `sales_id`) VALUES (?, ?)', [header['order_id'], id]);
          for (const lk of orderInfoLinks) {
            await run('INSERT INTO `kuyou_user_ordersaleinfo` (`sales_id`, `orderinfo_id`, `salesinfo_id`) VALUES (?, ?, ?)', [
              id,
              lk.infoId,
              lk.salesInfoId,
            ]);
          }
        }
      }
      return { id, code: header[c.codeField], mode };
    });
  }

  /**
   * 审核 / 反审核
   *  - 审核（state=1）：置审核位，仓库类单据按明细行增减库存，资金类单据按财务档案联动
   *  - 反审核（state=0）：清除审核位，库存按原方向冲回，财务数据整体冲回
   * 幂等保护：已审核不能重复审核，未审核不能反审核；无审核列的单据仅更新 examine_time。
   * 结账保护：单据时间早于或等于最近结账时间的一律不可审核 / 反审核（对应源 Checkout::checkOutTime）。
   * @param table 主表名
   * @param id    主表主键
   * @param state 1=审核 0=反审核
   * @param user  当前用户（写入 audit 人）
   * @returns { id, code, state }
   */
  async audit(table: string, id: number | string, state: 0 | 1, user?: any) {
    const c = this.cfg(table);
    const hm = this.meta(c.header);
    const link = detailLinkOf(c);
    const adminId = user?.uid ?? user?.id ?? null;

    // 结账期间校验（事务外预检，失败直接拒绝，与源系统一致）
    const head = (await this.conn.query(`SELECT * FROM \`${c.header}\` WHERE \`${hm.pk}\` = ? LIMIT 1`, [id]))[0];
    if (!head) throw new NotFoundException('单据不存在');
    const guard = await this.finance.checkOutTime((sql, p = []) => this.conn.query(sql, p), head.purchase_time);
    if (guard !== true) throw new BadRequestException(guard);

    return this.conn.transaction(async (em) => {
      const run: Runner = (sql, params = []) => em.query(sql, params);
      const doc = head;
      const now = Math.floor(Date.now() / 1000);

      // 1) 状态位（该单据可能没有审核流程，如成本调整单）
      // 源端审核位固定是 examine_status：GoodsPurchase 1598 行审核 update examine_status=1、
      // 1897 行反审核置 0，且全库按 examine_status 过滤「已审核」；check_status 实为「对单」位，
      // 由对单方法单独维护。此前误用 check_status，导致已审核单据的 examine_status 恒为 0，
      // 报表/列表筛选/下游「未审核不可生成」等按该字段的校验全部失效。
      const statusCol = this.hasCol(c.header, 'examine_status') ? 'examine_status' : c.statusField;
      if (statusCol && this.hasCol(c.header, statusCol)) {
        const cur = Number(doc[statusCol] || 0);
        if (state === 1 && cur === 1) throw new BadRequestException('单据已审核，请勿重复操作');
        if (state === 0 && cur === 0) throw new BadRequestException('单据未审核，无需反审核');
        // 状态位常见类型为 enum('0','1')：MySQL 对 ENUM 赋「数字」时按下标解释而非字面量
        // （enum('0','1') 中下标 1 对应 '0'），数字 1 写进去仍是 '0'，导致
        // 审核后状态不变（可重复审核）且反审核永远报「单据未审核」。故必须传字符串。
        await run(`UPDATE \`${c.header}\` SET \`${statusCol}\` = ? WHERE \`${hm.pk}\` = ?`, [String(state), id]);
        // 源端同步更新明细行审核位（GoodsPurchase 1599 / 1898 行）
        if (c.detail && this.hasCol(c.detail, statusCol)) {
          await run(`UPDATE \`${c.detail}\` SET \`${statusCol}\` = ? WHERE \`${link.detailField}\` = ?`, [
            String(state),
            doc[link.headerField],
          ]);
        }
      }
      if (this.hasCol(c.header, 'examine_time')) {
        await run(`UPDATE \`${c.header}\` SET \`examine_time\` = ? WHERE \`${hm.pk}\` = ?`, [state === 1 ? now : 0, id]);
      }
      if (state === 1) {
        if (this.hasCol(c.header, 'examine_id')) {
          await run(`UPDATE \`${c.header}\` SET \`examine_id\` = ? WHERE \`${hm.pk}\` = ?`, [adminId, id]);
        }
      } else if (this.hasCol(c.header, 'operation_id')) {
        await run(`UPDATE \`${c.header}\` SET \`operation_id\` = ? WHERE \`${hm.pk}\` = ?`, [adminId, id]);
      }

      const linkValue = doc[link.headerField];

      // 2) 普通出入库联动：单方向增减,
      if (c.stock && c.detail) {
        const s = c.stock;
        const sign = (s.direction === 'in' ? 1 : -1) * (state === 1 ? 1 : -1);
        const lines = await run(
          `SELECT \`${s.goodsField}\` AS goods_key, \`${s.storesField}\` AS stores_id, \`${s.qtyField}\` AS number${this.batchSelectCols(c.detail)} FROM \`${c.detail}\` WHERE \`${link.detailField}\` = ?`,
          [linkValue],
        );
        const bType = this.batchTypeOf(c);
        for (const line of lines) {
          const qty = Number(line.number || 0);
          if (!qty) continue;
          await this.applyStock(
            run,
            s.goodsField,
            line.goods_key,
            line.stores_id,
            sign * qty,
            now,
            this.batchCtxOf(line, bType, doc, c, adminId, state),
          );
        }
      }

      // 3) 调拨联动：调出仓减、调入仓加（反审核反向冲回）
      if (c.transfer && c.detail) {
        const t = c.transfer;
        const sign = state === 1 ? 1 : -1;
        const lines = await run(
          `SELECT \`${t.goodsField}\` AS goods_key, \`${t.fromField}\` AS stores_out, \`${t.toField}\` AS stores_enter, \`${t.qtyField}\` AS number${this.batchSelectCols(c.detail)} FROM \`${c.detail}\` WHERE \`${link.detailField}\` = ?`,
          [linkValue],
        );
        const bType = this.batchTypeOf(c);
        for (const line of lines) {
          const qty = Number(line.number || 0);
          if (!qty) continue;
          await this.applyStock(
            run,
            t.goodsField,
            line.goods_key,
            line.stores_out,
            -sign * qty,
            now,
            this.batchCtxOf(line, bType, doc, c, adminId, state),
          );
          await this.applyStock(
            run,
            t.goodsField,
            line.goods_key,
            line.stores_enter,
            sign * qty,
            now,
            this.batchCtxOf(line, bType, doc, c, adminId, state),
          );
        }
      }

      // 4) 财务联动：往来欠款 / 账户余额 / 账户流水 / 收付款流水 / 开票登记 / 核销推进
      await this.finance.post(run, c, doc, state, adminId);

      return { id, code: doc[c.codeField], state };
    });
  }

  /**
   * 对单 / 反对单（对应源 GoodsPurchase / GoodsSales / GoodsExchange / GoodsSalesExchange::counter）
   *
   * 与审核不同：对单只切换单据的核对位（check_status），不过账、不动库存与资金。
   *  - 对单（state=1）：check_status 0 → 1，记录最后操作人
   *  - 反对单（state=0）：check_status 1 → 0
   * 同样受结账期间保护：单据时间早于或等于最近结账时间不可操作。
   *
   * @param table 主表名（仅注册为购销类的单据可对单）
   * @param id    主表主键
   * @param state 1=对单 0=反对单
   * @param user  当前用户
   */
  async counter(table: string, id: number | string, state: 0 | 1, user?: any) {
    const c = this.cfg(table);
    const hm = this.meta(c.header);
    const adminId = user?.uid ?? user?.id ?? null;
    // 对单位：购销单据用 check_status，其余回落 statusField
    const field = this.hasCol(c.header, 'check_status') ? 'check_status' : c.statusField;
    if (!field) throw new BadRequestException('该单据无对单流程');

    const rows = await this.conn.query(`SELECT * FROM \`${c.header}\` WHERE \`${hm.pk}\` = ? LIMIT 1`, [id]);
    const doc = rows[0];
    if (!doc) throw new NotFoundException('单据不存在');
    const guard = await this.finance.checkOutTime((sql, p = []) => this.conn.query(sql, p), doc.purchase_time);
    if (guard !== true) throw new BadRequestException(guard);

    const cur = Number(doc[field] || 0);
    if (state === 1 && cur === 1) throw new BadRequestException('单据已对单，请勿重复操作');
    if (state === 0 && cur === 0) throw new BadRequestException('单据未对单，无需反对单');

    const sets: string[] = [`\`${field}\` = ?`];
    const vals: any[] = [state];
    if (this.hasCol(c.header, 'operation_id')) {
      sets.push('`operation_id` = ?');
      vals.push(adminId);
    }
    vals.push(id);
    await this.conn.query(`UPDATE \`${c.header}\` SET ${sets.join(', ')} WHERE \`${hm.pk}\` = ?`, vals);
    return { id, code: doc[c.codeField], state };
  }

  /**
   * 批次联动上下文
   * 明细行携带批次时，除常规库存外还需维护 kuyou_goods_batch_stock（批次库存）
   * 与 kuyou_goods_batch_log（批次流转日志），与源端各 examine 的批次处理一致。
   */
  private static readonly BATCH_TYPE: Record<string, string> = {
    purchase: '2',        // 普通采购
    purchaseRetreat: '3', // 采购退回
    sales: '4',           // 普通销售
    salesRetreat: '5',    // 销售退回
  };

  /** 按单据配置推导批次流转日志的 business_type（与 kuyou_goods_batch_log 注释一致） */
  private batchTypeOf(c: DocumentConfig): string {
    if (c.transfer) return '6'; // 调拨单
    if (c.finance && DocumentService.BATCH_TYPE[c.finance]) {
      return DocumentService.BATCH_TYPE[c.finance];
    }
    return c.stock?.direction === 'in' ? '8' : '10'; // 其他入库 / 其他出库
  }

  /**
   * 明细行携带的批次 ID。
   * 列名在不同明细表并不统一：购货 / 销货 / 其他入库等用 batch_id，
   * 而调拨明细 kuyou_allocation_info 用 goods_batch_id（源端建表同为 goods_batch_id）。
   * 必须两者都识别，否则调拨单的批次流转不会生效。
   */
  private batchIdOf(line: any): number {
    const v = Number(line?.batch_id || line?.goods_batch_id || 0);
    return v > 0 ? v : 0;
  }

  /** 明细表存在的批次/价格列，按需拼进 SELECT（避免在无该列的明细表上报未知列） */
  private batchSelectCols(detail: string): string {
    let sql = '';
    // period：源端用明细行该字段携带序列号（JSON 数组 [{serial,remark}]），与批次相互独立
    // 列名在不同明细表不统一：调拨明细用 goods_batch_id / goods_batch_name / goods_serial_id / goods_attr
    for (const col of ['id', 'batch_id', 'goods_batch_id', 'attribute_id', 'goods_attr', 'unit_price', 'all_money', 'tax_money', 'money_tax_price', 'goods_unit', 'period']) {
      if (this.hasCol(detail, col)) sql += `, \`${col}\``;
    }
    return sql;
  }

  /**
   * 组装明细行上下文（批次 + 序列号共用）。
   * 注意：不再因无批次而返回 undefined —— 序列号与批次相互独立
   * （商品可只启用序列号），批次联动由 applyStock 内 batchId>0 自行守卫。
   */
  private batchCtxOf(line: any, businessType: string, doc: any, c: DocumentConfig, adminId: any, state: number) {
    const batchId = this.batchIdOf(line);
    return {
      batchId,
      // 调拨明细的属性列名为 goods_attr，其余表为 attribute_id
      attributeId: Number(line.attribute_id || line.goods_attr || 0),
      businessType,
      purchaseCode: doc?.[c.codeField] ?? null,
      purchaseTime: doc?.purchase_time ?? null,
      // 仅取客户 ID（整型）。不可回退 supplyer_code —— 那是供应商编码字符串，
      // 写入整型的 customer_id 会直接报 Incorrect integer value 导致审核失败。
      customerId: doc?.customers_id ?? null,
      orderId: doc?.id ?? null,
      adminId,
      unitPrice: line.unit_price ?? null,
      allMoney: line.all_money ?? null,
      taxMoney: line.tax_money ?? null,
      moneyTaxPrice: line.money_tax_price ?? null,
      goodsUnit: line.goods_unit ?? null,
      purchaseInfoId: line.id ?? null,
      /** 序列号载体：多数明细表为 period，调拨明细为 goods_serial_id */
      period: line.period ?? line.goods_serial_id,
      state,
    };
  }

  /**
   * 解析明细行 period 字段中的序列号。
   * 源端该字段为 JSON 数组 [{serial, remark}]（GoodsPurchase 1337 行 json_decode）。
   * 兼容：已是数组直接用；字符串按 JSON 解析；解析失败或为空返回空数组。
   */
  private parseSerials(period: any): { serial: string; remark: string | null }[] {
    let v = period;
    if (typeof v === 'string') {
      try {
        v = JSON.parse(v);
      } catch {
        // 非 JSON：按逗号 / 换行 / 空格分隔的纯序列号串（调拨 goods_serial_id 可能如此）
        return v
          .split(/[,，\s]+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => ({ serial: s, remark: null }));
      }
    }
    if (!Array.isArray(v)) return [];
    return v
      .map((r: any) =>
        typeof r === 'string'
          ? { serial: r.trim(), remark: null }
          : { serial: String(r?.serial ?? '').trim(), remark: r?.remark ?? null },
      )
      .filter((r) => r.serial);
  }

  /**
   * 库存增减（单个仓位）
   * 同时维护两处数据：kuyou_goods.inventory（商品主档冗余库存）与 kuyou_goods_stock（分仓库存）。
   * 明细行携带批次时，额外按 (商品,仓库,批次,属性) 维护 kuyou_goods_batch_stock 并写流转日志。
   * @param run        SQL 执行器（事务内）
   * @param goodsField 明细表商品列名（goods_code 或 goods_id，对应 kuyou_goods_stock 同名列）
   * @param goodsKey   商品码 / 商品 ID
   * @param storesId   仓库 ID
   * @param delta      增量（正=入库，负=出库）
   * @param now        当前秒级时间戳
   * @param batch      批次上下文（可选；仅批次商品传入）
   */
  private async applyStock(
    run: Runner,
    goodsField: string,
    goodsKey: any,
    storesId: any,
    delta: number,
    now: number,
    batch?: {
      batchId: number;
      attributeId?: number;
      businessType?: string;
      purchaseCode?: any;
      purchaseTime?: any;
      customerId?: any;
      orderId?: any;
      adminId?: any;
      unitPrice?: any;
      allMoney?: any;
      taxMoney?: any;
      moneyTaxPrice?: any;
      goodsUnit?: any;
      /** 明细行主键，写入 kuyou_goods_batch_info.purchase_info_id，用于成本回溯到来源单据行 */
      purchaseInfoId?: any;
      /** 明细行 period 字段（JSON 数组），携带待登记的序列号 */
      period?: any;
      /** 审核方向：1=审核，0=反审核（反审核时按源端语义删除批次流水） */
      state?: number;
    },
  ) {
    if (goodsKey === undefined || goodsKey === null || goodsKey === '') return;
    const stockCol = goodsField === 'goods_code' ? 'goods_code' : 'goods_id';
    const goodsFilter = goodsField === 'goods_code' ? 'goods_code' : 'id';

    // 1) 商品主档冗余库存
    await run(`UPDATE \`kuyou_goods\` SET \`inventory\` = \`inventory\` + ? WHERE \`${goodsFilter}\` = ?`, [
      delta,
      goodsKey,
    ]);

    // 2) 分仓库存：已存在则累加，否则插入新行
    const exist = await run(
      `SELECT \`id\`, \`stock\` FROM \`kuyou_goods_stock\` WHERE \`${stockCol}\` = ? AND \`stores_id\` = ? AND \`deletetime\` IS NULL LIMIT 1`,
      [goodsKey, storesId],
    );
    if (exist[0]) {
      await run(`UPDATE \`kuyou_goods_stock\` SET \`stock\` = \`stock\` + ?, \`updatetime\` = ? WHERE \`id\` = ?`, [
        delta,
        now,
        exist[0].id,
      ]);
    } else {
      const goods = await run(`SELECT \`id\`, \`admin_id\`, \`goods_code\` FROM \`kuyou_goods\` WHERE \`${goodsFilter}\` = ? LIMIT 1`, [
        goodsKey,
      ]);
      const gid = goodsField === 'goods_code' ? goodsKey : Number(goodsKey);
      await run(
        `INSERT INTO \`kuyou_goods_stock\` (\`admin_id\`, \`goods_id\`, \`goods_code\`, \`stores_id\`, \`stock\`, \`status\`, \`createtime\`, \`updatetime\`) VALUES (?, ?, ?, ?, ?, '1', ?, ?)`,
        [goods[0]?.admin_id ?? null, goods[0]?.id ?? gid, goods[0]?.goods_code ?? null, storesId, delta, now, now],
      );
    }

    // 3) 批次库存与流转日志（源端购货/销货/出入库/调拨等 examine 均维护，目标端此前完全缺失）
    if (batch && batch.batchId > 0) {
      const g = await run(`SELECT \`id\`, \`goods_code\`, \`admin_id\` FROM \`kuyou_goods\` WHERE \`${goodsFilter}\` = ? LIMIT 1`, [goodsKey]);
      const goodsId = g[0]?.id ?? (goodsField === 'goods_id' ? Number(goodsKey) : 0);
      const goodsCode = g[0]?.goods_code ?? (goodsField === 'goods_code' ? String(goodsKey) : null);
      const attrId = Number(batch.attributeId || 0);

      // 已存在批次库存行则累加，否则新建（与源 GoodsPurchase 1539-1544 一致）
      const bs = await run(
        'SELECT `id`, `stock` FROM `kuyou_goods_batch_stock` WHERE `goods_id` = ? AND `stores_id` = ? AND `batch_id` = ? AND `attribute_id` = ? LIMIT 1',
        [goodsId, storesId, batch.batchId, attrId],
      );
      // 出库侧批次库存不足校验：源端各 examine 对批次库存不足直接报错拦截
      // （如 GoodsPurchase 1777-1778「库存不足」），目标端若不校验会把批次库存扣成负数。
      if (delta < 0 && Number(bs[0]?.stock || 0) + delta < -1e-6) {
        throw new BadRequestException(
          `批次库存不足：商品 ${goodsCode} 批次ID ${batch.batchId}，现存 ${Number(bs[0]?.stock || 0)}，需出库 ${Math.abs(delta)}`,
        );
      }
      if (bs[0]) {
        await run('UPDATE `kuyou_goods_batch_stock` SET `stock` = `stock` + ?, `updatetime` = ? WHERE `id` = ?', [
          delta,
          now,
          bs[0].id,
        ]);
      } else {
        await run(
          'INSERT INTO `kuyou_goods_batch_stock` (`admin_id`,`batch_id`,`goods_id`,`goods_code`,`attribute_id`,`stores_id`,`stock`,`status`,`createtime`,`updatetime`) VALUES (?,?,?,?,?,?,?,\'1\',?,?)',
          [g[0]?.admin_id ?? null, batch.batchId, goodsId, goodsCode, attrId, storesId, delta, now, now],
        );
      }

      // 批次流转日志：审核时登记；反审核严格按源端语义删除该批次流水
      // （源 GoodsPurchase 1880 行：按 business_type + order_id 删除），而非写负数冲回，
      // 与源端保持一致，避免流水中残留冲回行。
      if (batch.state === 0) {
        await run('DELETE FROM `kuyou_goods_batch_log` WHERE `business_type` = ? AND `order_id` = ? AND `batch_id` = ?', [
          batch.businessType ?? null,
          batch.orderId ?? null,
          batch.batchId,
        ]);
      } else {
        await run(
          'INSERT INTO `kuyou_goods_batch_log` (`admin_id`,`goods_id`,`unit_price`,`tax_included`,`all_money`,`tax_money`,`money_tax_price`,`goods_unit`,`stores_id`,`batch_id`,`number`,`purchase_code`,`purchase_time`,`business_type`,`customer_id`,`remarks`,`order_id`,`createtime`,`updatetime`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [
            batch.adminId ?? null,
            goodsId,
            batch.unitPrice ?? null,
            batch.unitPrice ?? null,
            batch.allMoney ?? null,
            batch.taxMoney ?? null,
            batch.moneyTaxPrice ?? null,
            batch.goodsUnit ?? null,
            storesId,
            batch.batchId,
            delta,
            batch.purchaseCode ?? null,
            batch.purchaseTime ?? now,
            batch.businessType ?? null,
            batch.customerId ?? null,
            null,
            batch.orderId ?? null,
            now,
            now,
          ],
        );
      }

      // 4) 批次明细（成本来源挂钩）：记录该批次来自哪张单据的哪一行，使成本可回溯到来源单据行。
      // 源端在单据保存时创建(status=0)、审核时按 purchase_info_id 批量激活为 1（GoodsPurchase 1581 行）；
      // 目标端此前完全不写该表，批次成本无法追溯。此处在入库侧(delta>0)建行并直接置为已激活。
      if (delta > 0) {
        const b = await run('SELECT `batch_name`,`manufacture`,`guarantee`,`validity` FROM `kuyou_goods_batch` WHERE `id` = ? LIMIT 1', [batch.batchId]);
        const piWhere = batch.purchaseInfoId ? 'AND `purchase_info_id` = ?' : 'AND `purchase_info_id` IS NULL';
        const piParams = batch.purchaseInfoId ? [batch.purchaseInfoId] : [];
        const existInfo = await run(
          `SELECT \`id\` FROM \`kuyou_goods_batch_info\` WHERE \`batch_id\` = ? AND \`goods_id\` = ? AND \`stores_id\` = ? AND \`attribute_id\` = ? ${piWhere} LIMIT 1`,
          [batch.batchId, goodsId, storesId, attrId, ...piParams],
        );
        if (existInfo[0]) {
          await run('UPDATE `kuyou_goods_batch_info` SET `stock` = `stock` + ?, `status` = \'1\', `updatetime` = ? WHERE `id` = ?', [
            delta,
            now,
            existInfo[0].id,
          ]);
        } else {
          // type：1=期初,2=购货,3=盘盈,4=其他入库,5=组合单,6=拆卸单
          const t = batch.businessType === '1' ? 1 : batch.businessType === '2' ? 2 : batch.businessType === '8' ? 4 : 0;
          await run(
            'INSERT INTO `kuyou_goods_batch_info` (`admin_id`,`batch_id`,`goods_id`,`goods_code`,`attribute_id`,`goods_unit`,`stores_id`,`stock`,`status`,`number`,`batch_name`,`manufacture`,`guarantee`,`validity`,`purchase_id`,`purchase_info_id`,`type`,`createtime`,`updatetime`) VALUES (?,?,?,?,?,?,?,?,\'1\',?,?,?,?,?,?,?,?,?,?)',
            [
              batch.adminId ?? null,
              batch.batchId,
              goodsId,
              goodsCode,
              attrId,
              batch.goodsUnit ?? null,
              storesId,
              delta,
              delta,
              b[0]?.batch_name ?? null,
              b[0]?.manufacture ?? null,
              b[0]?.guarantee ?? null,
              b[0]?.validity ?? null,
              batch.orderId ?? null,
              batch.purchaseInfoId ?? null,
              t,
              now,
              now,
            ],
          );
        }
      }

      // 5) 出库侧批次明细：销货 / 销货退货 / 购货退货分别落各自的批次子表
      // 源端 Sales、SalesExchange、Exchange 等 examine 均写入对应批次子表；目标端此前
      // 仅零售链路写了 kuyou_goods_batch_sale_info，非零售的销货单、销货退货单、
      // 购货退货单完全缺失，批次出库无明细可追溯。
      if (delta < 0) {
        const btMap: Record<string, string> = {
          '4': 'kuyou_goods_batch_sale_info',      // 普通销售
          '5': 'kuyou_goods_batch_salee_info',     // 销售退回
          '3': 'kuyou_goods_batch_exchange_info',  // 采购退回
        };
        const bt = btMap[String(batch.businessType)] ?? null;
        if (bt) {
          const bm = await run('SELECT `batch_name`,`manufacture`,`guarantee`,`validity` FROM `kuyou_goods_batch` WHERE `id` = ? LIMIT 1', [batch.batchId]);
          const outQty = Math.abs(delta);
          await run(
            `INSERT INTO \`${bt}\` (\`admin_id\`,\`batch_id\`,\`goods_id\`,\`goods_code\`,\`attribute_id\`,\`goods_unit\`,\`stores_id\`,\`stock\`,\`status\`,\`number\`,\`batch_name\`,\`manufacture\`,\`guarantee\`,\`validity\`,\`purchase_id\`,\`purchase_info_id\`,\`type\`,\`createtime\`,\`updatetime\`) VALUES (?,?,?,?,?,?,?,?,'1',?,?,?,?,?,?,?,?,?,?)`,
            [
              batch.adminId ?? null,
              batch.batchId,
              goodsId,
              goodsCode,
              attrId,
              batch.goodsUnit ?? null,
              storesId,
              outQty,
              outQty,
              bm[0]?.batch_name ?? null,
              bm[0]?.manufacture ?? null,
              bm[0]?.guarantee ?? null,
              bm[0]?.validity ?? null,
              batch.orderId ?? null,
              batch.purchaseInfoId ?? null,
              2, // 与源端一致：销货/退货批次明细 type=>2
              now,
              now,
            ],
          );
        }
      }
    }

    // 6) 序列号登记（源 GoodsPurchase 1340-1381：明细行 period 携带序列号，入库审核时登记）
    // 目标端此前仅零售出库标记过序列号，采购 / 其他入库等入库单据审核完全不登记，
    // 导致启用序列号的商品无法在入库时建立序列号档案与跟踪流水。
    // 注：序列号与批次相互独立，故此处在批次块之外处理。
    if (batch?.period && batch.purchaseInfoId) {
      const serials = this.parseSerials(batch.period);
      if (serials.length) {
        if (batch.state === 0) {
          // 反审核：与源端一致删除该明细行登记的序列号与跟踪流水（源 1882-1883）
          await run('DELETE FROM `kuyou_goods_serial` WHERE `purchase_id` = ?', [batch.purchaseInfoId]);
          await run('DELETE FROM `kuyou_goods_serial_log` WHERE `business_type` = ? AND `order_id` = ?', [
            batch.businessType,
            batch.purchaseInfoId,
          ]);
        } else if (delta > 0) {
          // 入库审核：逐条登记（已存在则更新为在库，否则新建）
          const gs = await run(`SELECT \`id\`, \`goods_code\`, \`admin_id\` FROM \`kuyou_goods\` WHERE \`${goodsFilter}\` = ? LIMIT 1`, [goodsKey]);
          const sGoodsId = gs[0]?.id ?? (goodsField === 'goods_id' ? Number(goodsKey) : 0);
          const sGoodsCode = gs[0]?.goods_code ?? (goodsField === 'goods_code' ? String(goodsKey) : null);
          for (const s of serials) {
            const exist = await run('SELECT `id`,`status`,`store_status` FROM `kuyou_goods_serial` WHERE `serial` = ? LIMIT 1', [s.serial]);
            if (exist[0]) {
              // 已存在：按源 1564-1571 置为在库，并把原状态留存到 old_status / old_store
              await run(
                'UPDATE `kuyou_goods_serial` SET `purchase_id`=?, `purchase_code`=?, `stores_id`=?, `status`=?, `store_status`=?, `old_status`=?, `old_store`=?, `updatetime`=? WHERE `id`=?',
                [
                  batch.purchaseInfoId,
                  batch.purchaseCode,
                  storesId,
                  '1',
                  '1',
                  exist[0].status ?? null,
                  exist[0].store_status ?? null,
                  now,
                  exist[0].id,
                ],
              );
            } else {
              await run(
                'INSERT INTO `kuyou_goods_serial` (`admin_id`,`goods_id`,`goods_code`,`stores_id`,`attribute_id`,`serial`,`status`,`store_status`,`remark`,`purchase_id`,`purchase_code`,`order_id`,`createtime`,`updatetime`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                [
                  batch.adminId ?? null,
                  sGoodsId,
                  sGoodsCode,
                  storesId,
                  Number(batch.attributeId || 0),
                  s.serial,
                  '1',
                  '1',
                  s.remark ?? null,
                  batch.purchaseInfoId,
                  batch.purchaseCode,
                  batch.purchaseInfoId,
                  now,
                  now,
                ],
              );
            }
            await run(
              'INSERT INTO `kuyou_goods_serial_log` (`admin_id`,`goods_id`,`stores_id`,`attribute_id`,`serial`,`business_type`,`store_status`,`remarks`,`purchase_id`,`purchase_code`,`purchase_time`,`order_id`,`createtime`,`updatetime`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
              [
                batch.adminId ?? null,
                sGoodsId,
                storesId,
                Number(batch.attributeId || 0),
                s.serial,
                batch.businessType,
                '1',
                s.remark ?? null,
                batch.purchaseInfoId,
                batch.purchaseCode,
                batch.purchaseTime,
                batch.purchaseInfoId,
                now,
                now,
              ],
            );
          }
        }
      }
    }
  }
}
