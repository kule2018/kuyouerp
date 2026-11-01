import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tool } from '../tool.decorator';
import { ToolCallbacks } from '../tool-callbacks';
import { Goods } from '../../../entities/kuyou_goods.entity';
import { Customers } from '../../../entities/kuyou_customers.entity';
import { TABLE_META } from '../../../table-meta';

/**
 * ERP 业务工具集（Function Calling）
 * 每个方法用 @Tool 声明，可被 Agent / ChatClient 在对话中自动调用。
 * 构造时把自身注册进 ToolCallbacks，供全局发现。
 *
 * 新增的业务型工具（库存预警 / 智能补货 / 销售排行 / 应收分析 / 呆滞库存）
 * 直接基于连接做实时分析，全部带 try/catch，单表结构差异不会让对话崩溃。
 */
@Injectable()
export class ErpToolsService {
  constructor(
    @InjectRepository(Goods)
    private readonly goodsRepo: Repository<Goods>,
    @InjectRepository(Customers)
    private readonly customersRepo: Repository<Customers>,
    @InjectConnection()
    private readonly conn: Connection,
    private readonly toolCallbacks: ToolCallbacks,
  ) {
    // 注册本实例的全部 @Tool 方法
    this.toolCallbacks.register(this);
  }

  /** 查询商品（按名称/编号/分类） */
  @Tool({
    name: 'query_goods',
    description: '按关键词或商品分类查询商品，返回商品编码、名称、零售价与库存',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '商品名称或编号关键字' },
        goodsTypeId: { type: 'integer', description: '商品分类ID' },
      },
      required: [],
    },
  })
  async queryGoods(args: { keyword?: string; goodsTypeId?: number }) {
    const qb = this.goodsRepo.createQueryBuilder('g');
    qb.where('g.deletetime IS NULL');
    if (args?.keyword) {
      qb.andWhere('g.goods_name LIKE :k OR g.goods_code LIKE :k', { k: `%${args.keyword}%` });
    }
    if (args?.goodsTypeId) {
      qb.andWhere('g.goods_type_id = :t', { t: args.goodsTypeId });
    }
    const list = await qb.limit(20).getMany();
    return list.map((g) => ({
      id: g.id,
      code: g.goodsCode,
      name: g.goodsName,
      price: g.marketSellPrice,
      stock: g.inventory,
    }));
  }

  /** 查询客户 */
  @Tool({
    name: 'query_customers',
    description: '按名称关键字查询客户，返回客户ID与名称',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: '客户名称关键字' } },
      required: [],
    },
  })
  async queryCustomers(args: { name?: string }) {
    const qb = this.customersRepo.createQueryBuilder('c');
    qb.where('c.deletetime IS NULL');
    if (args?.name) {
      qb.andWhere('c.username LIKE :n OR c.name LIKE :n', { n: `%${args.name}%` });
    }
    const list = await qb.limit(20).getMany();
    return list.map((c) => ({
      id: c.id,
      name: c.customerName,
      contacts: c.connetName,
      mobile: c.customerMobile,
    }));
  }

  /** 安全计算器 */
  @Tool({
    name: 'calculator',
    description: '计算四则运算数学表达式，如 "12*3+5"',
    parameters: {
      type: 'object',
      properties: { expression: { type: 'string', description: '数学表达式' } },
      required: ['expression'],
    },
  })
  async calculator(args: { expression: string }) {
    const expr = args?.expression || '';
    if (!/^[\d+\-*/().\s]+$/.test(expr)) {
      return { error: '仅支持数字与 + - * / ( ) 运算' };
    }
    try {
      // eslint-disable-next-line no-new-func
      const value = Function(`"use strict"; return (${expr});`)();
      return { result: value };
    } catch (e: any) {
      return { error: e?.message || '计算失败' };
    }
  }

  /**
   * 库存预警：返回库存 <= 阈值（默认 0，即缺货/负库存）的商品。
   * 用于「哪些商品需要紧急补货」类问题。
   */
  @Tool({
    name: 'inventory_warning',
    description: '查询库存低于或等于阈值的商品（默认阈值0，即缺货与负库存），返回编码、名称、当前库存',
    parameters: {
      type: 'object',
      properties: {
        threshold: { type: 'number', description: '库存预警阈值，默认0' },
        limit: { type: 'integer', description: '返回条数，默认50' },
      },
      required: [],
    },
  })
  async inventoryWarning(args: { threshold?: number; limit?: number }) {
    const threshold = args?.threshold ?? 0;
    const limit = Math.min(200, args?.limit ?? 50);
    try {
      const rows = await this.conn.query(
        'SELECT `goods_code`,`goods_name`,`inventory` FROM `kuyou_goods` WHERE `status`=1 AND `inventory` <= ? ORDER BY `inventory` ASC LIMIT ?',
        [threshold, limit],
      );
      return { count: rows.length, items: rows };
    } catch (e: any) {
      return { error: '库存预警查询失败：' + (e?.message || e) };
    }
  }

  /**
   * 智能补货建议：基于近 30 天已审核销售，估算日均销量，给出补货量建议。
   * 补货量 = max(0, 日均销量 * 备货天数(默认15) - 现有库存)。
   */
  @Tool({
    name: 'purchase_suggestion',
    description:
      '基于近30天已审核销售估算日均销量，给出智能补货建议（补货量=日均销量×备货天数-现有库存），返回需补货商品清单',
    parameters: {
      type: 'object',
      properties: {
        leadTime: { type: 'integer', description: '备货天数，默认15' },
        limit: { type: 'integer', description: '返回条数，默认50' },
      },
      required: [],
    },
  })
  async purchaseSuggestion(args: { leadTime?: number; limit?: number }) {
    const leadTime = args?.leadTime ?? 15;
    const limit = Math.min(200, args?.limit ?? 50);
    const since = Math.floor(Date.now() / 1000) - 30 * 86400;
    try {
      const rows = await this.conn.query(
        `SELECT g.\`goods_code\`, g.\`goods_name\`, g.\`inventory\` AS stock,
                COALESCE(SUM(si.\`number\`),0) AS sold_30d
         FROM \`kuyou_goods\` g
         LEFT JOIN \`kuyou_sales_info\` si ON si.\`goods_code\` = g.\`goods_code\`
         LEFT JOIN \`kuyou_sales\` s ON s.\`sales_code\` = si.\`sales_code\` AND s.\`examine_status\`=1 AND s.\`createtime\` >= ?
         WHERE g.\`status\`=1
         GROUP BY g.\`goods_code\`, g.\`goods_name\`, g.\`inventory\`
         HAVING stock < (COALESCE(SUM(si.\`number\`),0)/30)*?
         ORDER BY (COALESCE(SUM(si.\`number\`),0)/30) DESC
         LIMIT ?`,
        [since, leadTime, limit],
      );
      const items = rows.map((r: any) => {
        const daily = Number(r.sold_30d || 0) / 30;
        const suggest = Math.max(0, Math.ceil(daily * leadTime - Number(r.stock || 0)));
        return { ...r, daily_avg: Math.round(daily * 100) / 100, suggest };
      });
      return { count: items.length, leadTime, items };
    } catch (e: any) {
      return { error: '智能补货查询失败：' + (e?.message || e) };
    }
  }

  /** 销售排行：按近30天已审核销售额排序的热销商品 */
  @Tool({
    name: 'sales_ranking',
    description: '返回销售额排行前列的商品（近30天已审核销货），用于销售分析',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'integer', description: '返回条数，默认20' } },
      required: [],
    },
  })
  async salesRanking(args: { limit?: number }) {
    const limit = Math.min(200, args?.limit ?? 20);
    const since = Math.floor(Date.now() / 1000) - 30 * 86400;
    try {
      const rows = await this.conn.query(
        `SELECT g.\`goods_code\`, g.\`goods_name\`,
                COALESCE(SUM(si.\`number\`),0) AS qty,
                COALESCE(SUM(si.\`all_money\`),0) AS amount
         FROM \`kuyou_goods\` g
         LEFT JOIN \`kuyou_sales_info\` si ON si.\`goods_code\` = g.\`goods_code\`
         LEFT JOIN \`kuyou_sales\` s ON s.\`sales_code\` = si.\`sales_code\` AND s.\`examine_status\`=1 AND s.\`createtime\` >= ?
         WHERE g.\`status\`=1
         GROUP BY g.\`goods_code\`, g.\`goods_name\`
         ORDER BY amount DESC
         LIMIT ?`,
        [since, limit],
      );
      return { count: rows.length, items: rows };
    } catch (e: any) {
      return { error: '销售排行查询失败：' + (e?.message || e) };
    }
  }

  /** 应收分析：欠款为正的客户（应收预警） */
  @Tool({
    name: 'receivable_analysis',
    description: '返回存在应收欠款的客户清单（按欠款降序），用于应收预警与催收',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'integer', description: '返回条数，默认50' } },
      required: [],
    },
  })
  async receivableAnalysis(args: { limit?: number }) {
    const limit = Math.min(200, args?.limit ?? 50);
    try {
      const rows = await this.conn.query(
        'SELECT `customer_name`,`arrears` FROM `kuyou_customers` WHERE `arrears` > 0 ORDER BY `arrears` DESC LIMIT ?',
        [limit],
      );
      return { count: rows.length, items: rows };
    } catch (e: any) {
      // 列名可能因实施差异不同，失败给出可读提示而非崩溃
      return { error: '应收分析查询失败（可能缺少 arrears 列）：' + (e?.message || e) };
    }
  }

  /**
   * 呆滞/积压库存：近30天无销售却有库存的商品。
   */
  @Tool({
    name: 'overstock_analysis',
    description: '返回近30天无销售却仍有库存的商品（呆滞/积压库存），用于清仓与资金占用分析',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'integer', description: '返回条数，默认50' } },
      required: [],
    },
  })
  async overstockAnalysis(args: { limit?: number }) {
    const limit = Math.min(200, args?.limit ?? 50);
    const since = Math.floor(Date.now() / 1000) - 30 * 86400;
    try {
      const rows = await this.conn.query(
        `SELECT g.\`goods_code\`, g.\`goods_name\`, g.\`inventory\` AS stock,
                COALESCE(SUM(si.\`number\`),0) AS sold_30d
         FROM \`kuyou_goods\` g
         LEFT JOIN \`kuyou_sales_info\` si ON si.\`goods_code\` = g.\`goods_code\`
         LEFT JOIN \`kuyou_sales\` s ON s.\`sales_code\` = si.\`sales_code\` AND s.\`examine_status\`=1 AND s.\`createtime\` >= ?
         WHERE g.\`status\`=1
         GROUP BY g.\`goods_code\`, g.\`goods_name\`, g.\`inventory\`
         HAVING sold_30d = 0 AND stock > 0
         ORDER BY stock DESC
         LIMIT ?`,
        [since, limit],
      );
      return { count: rows.length, items: rows };
    } catch (e: any) {
      return { error: '呆滞库存分析失败：' + (e?.message || e) };
    }
  }

  /**
   * 通用数据查询（自然语言转查询 NL2SQL 的核心工具）
   * 支持：指定表 + 返回字段 + 等值过滤 + 时间范围(unix秒) + 排序分页；
   *       或聚合模式（sum/avg/min/max/count 某一数值列）。
   * 表名/列名全部走 TABLE_META 白名单，杜绝 SQL 注入。
   * 这是让助手能回答「本月销售额」「各仓库库存」等问题的关键能力。
   */
  @Tool({
    name: 'erp_query',
    description:
      '通用 ERP 数据查询工具，用于把自然语言问题转成数据查询（NL2SQL）。可对任意业务表做列表查询或聚合统计。' +
      '参数：table=业务表名(如 kuyou_goods_sales/kuyou_goods/kuyou_customers)；mode=list 或 aggregate；' +
      'aggregateField+aggregate=对数值列做 sum/avg/min/max/count；fields=返回字段；where=等值过滤对象；' +
      'timeField+timeFrom+timeTo=时间范围(unix秒，常见于 createtime/updatetime)；orderBy/order/limit=排序分页。',
    parameters: {
      type: 'object',
      properties: {
        table: { type: 'string', description: '业务表名，如 kuyou_goods_sales / kuyou_goods / kuyou_customers' },
        mode: { type: 'string', description: '查询模式：list=列表(默认), aggregate=聚合统计' },
        fields: { type: 'array', items: { type: 'string' }, description: '返回字段列表，留空返回全部列' },
        where: { type: 'object', description: '等值过滤条件，如 {"examine_status":1,"store_id":3}' },
        timeField: { type: 'string', description: '时间字段名(通常为 createtime/updatetime)' },
        timeFrom: { type: 'number', description: '时间范围起点(unix 秒)' },
        timeTo: { type: 'number', description: '时间范围终点(unix 秒)' },
        aggregate: { type: 'string', description: '聚合函数: sum/avg/min/max/count(仅 aggregate 模式)' },
        aggregateField: { type: 'string', description: '聚合目标列(仅 aggregate 模式)' },
        orderBy: { type: 'string', description: '排序字段' },
        order: { type: 'string', description: '排序方向 asc/desc' },
        limit: { type: 'number', description: '返回条数，默认 20，最大 500' },
      },
      required: ['table'],
    },
  })
  async erpQuery(args: {
    table: string;
    mode?: string;
    fields?: string[];
    where?: Record<string, any>;
    timeField?: string;
    timeFrom?: number;
    timeTo?: number;
    aggregate?: string;
    aggregateField?: string;
    orderBy?: string;
    order?: string;
    limit?: number;
  }) {
    const table = args?.table;
    const meta = TABLE_META[table];
    if (!meta) return { error: `未知或未授权的数据表: ${table}` };
    const cols = new Set(meta.columns);
    const params: any[] = [];
    const whereSql: string[] = [];
    if (meta.hasDt) whereSql.push('`deletetime` IS NULL');

    if (args.where && typeof args.where === 'object') {
      for (const [k, v] of Object.entries(args.where)) {
        if (!cols.has(k) || v === undefined || v === null || v === '') continue;
        whereSql.push(`\`${k}\` = ?`);
        params.push(v);
      }
    }
    if (args.timeField && cols.has(args.timeField) && (args.timeFrom != null || args.timeTo != null)) {
      if (args.timeFrom != null) {
        whereSql.push(`\`${args.timeField}\` >= ?`);
        params.push(args.timeFrom);
      }
      if (args.timeTo != null) {
        whereSql.push(`\`${args.timeField}\` <= ?`);
        params.push(args.timeTo);
      }
    }
    const w = whereSql.length ? ' WHERE ' + whereSql.join(' AND ') : '';

    try {
      if (args.mode === 'aggregate' && args.aggregate && args.aggregateField && cols.has(args.aggregateField)) {
        const fn = String(args.aggregate).toLowerCase();
        if (!['sum', 'avg', 'min', 'max', 'count'].includes(fn)) {
          return { error: '不支持的聚合函数: ' + fn };
        }
        const sql = `SELECT ${fn}(\`${args.aggregateField}\`) AS value FROM \`${table}\`${w}`;
        const row = (await this.conn.query(sql, params))[0];
        return { aggregate: fn, field: args.aggregateField, value: row?.value ?? null };
      }
      let select = '*';
      if (args.fields && Array.isArray(args.fields) && args.fields.length) {
        const f = args.fields.filter((c) => cols.has(c));
        if (f.length) select = f.map((c) => `\`${c}\``).join(',');
      }
      const order = args.orderBy && cols.has(args.orderBy) ? args.orderBy : meta.pk;
      const dir = String(args.order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      const limit = Math.min(500, Number(args.limit) || 20);
      const sql = `SELECT ${select} FROM \`${table}\`${w} ORDER BY \`${order}\` ${dir} LIMIT ${limit}`;
      const rows = await this.conn.query(sql, params);
      return { count: rows.length, rows };
    } catch (e: any) {
      return { error: '查询失败：' + (e?.message || e) };
    }
  }
}
