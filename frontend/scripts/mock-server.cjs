/**
 * 本地 Mock 后端（CommonJS）。
 *
 * 用途：本机没有 MySQL 时，也能把前端跑起来看真实渲染效果 / 做 UI 走查。
 * 特点：**不是胡乱造数据** —— 启动时用 esbuild 直接读 `src/config/modules.ts`
 *       拿到 156 张表的字段元数据，再按字段类型（number / select 枚举 / date / text）
 *       生成形状正确的假值，所以列表页的每一列都能正常显示，一眼就能看出排版问题。
 *
 * 用法：
 *   node scripts/mock-server.cjs                 # 默认 3100 端口，每接口 8 行
 *   PORT=3101 ROWS=0 node scripts/mock-server.cjs
 * 配合：
 *   npm run build && npm run preview             # preview 已把 /kuyou 代理到本服务
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const Module = require('module');
const esbuild = require('esbuild');

const PORT = Number(process.env.PORT || 3100);
const ROWS = Number(process.env.ROWS ?? 8);
const CONFIG_FILE = path.join(__dirname, '..', 'src', 'config', 'modules.ts');

/**
 * 用 esbuild 即时转译 TS 配置并求值，拿到表字段元数据。
 *
 * @param {string} file 配置文件绝对路径
 * @returns {Record<string, any>} 模块导出
 */
function loadConfig(file) {
  const code = esbuild.transformSync(fs.readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs' }).code;
  const m = new Module(file, null);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(code, file);
  return m.exports;
}

/** key -> 表定义（含 columns） */
const TABLES = {};
try {
  for (const mod of loadConfig(CONFIG_FILE).MODULES || []) TABLES[mod.key] = mod;
  console.log(`已加载 ${Object.keys(TABLES).length} 张表的字段元数据`);
} catch (e) {
  console.warn('读取 modules.ts 失败，退化为通用字段：', e.message);
}

/**
 * 按字段元数据生成一个合理的假值。
 *
 * @param {{prop: string, label: string, type: string, enum?: {value: string, label: string}[]|null}} col 字段定义
 * @param {number} i 行序号（0 基）
 * @param {number} w 列序号，用于让不同列取不同的文案
 * @returns {string|number} 假值
 */
function valueFor(col, i, w) {
  const n = i + 1;
  const prop = String(col.prop || '');
  if (prop === 'id' || prop === 'uid' || prop === 'pk') return n;
  if (prop === 'admin_id') return 1;
  if (col.enum && col.enum.length) return col.enum[i % col.enum.length].value;
  if (col.type === 'number') {
    // 金额类给两位小数，数量类给整数，避免出现 0.30000000004 之类
    return /amount|money|price|total|fee|cost|rate|discount/i.test(prop) ? Number((n * 128.5).toFixed(2)) : n * 10;
  }
  if (col.type === 'date' || col.type === 'datetime' || /time|date/i.test(prop)) {
    const day = String(10 + i).padStart(2, '0');
    return col.type === 'date' ? `2026-10-${day}` : `2026-10-${day} 09:30:00`;
  }
  // 文本类：用字段中文标签 + 序号，便于确认「这一列到底绑没绑对」
  return `${col.label || prop}-${String(n).padStart(2, '0')}`;
}

/**
 * 依据表定义造一行数据。
 *
 * @param {any} table 表定义；缺失时走通用字段
 * @param {number} i 行序号
 * @returns {Record<string, any>} 单行
 */
function makeRow(table, i) {
  const cols = table && Array.isArray(table.columns) ? table.columns : null;
  if (!cols || !cols.length) {
    const seq = String(i + 1).padStart(3, '0');
    return { id: i + 1, code: `NO-${seq}`, name: `示例 ${seq}`, amount: '128.50', remark: '演示数据' };
  }
  /** @type {Record<string, any>} */
  const row = {};
  cols.forEach((c, w) => {
    row[c.prop] = valueFor(c, i, w);
  });
  if (table.pk) row[table.pk] = i + 1;
  row.id = i + 1;
  return row;
}

/**
 * 上游单据明细行（生产链各单据结构基本一致）
 *
 * @param {number} from 起始序号
 * @param {number} count 行数
 * @returns {any[]}
 */
function productionLines(from, count) {
  return Array.from({ length: count }, (_, i) => ({
    id: from + i,
    goods_id: from + i,
    goods_code: `SP${String(1001 + from + i)}`,
    goods_name: `示例商品 ${from + i}`,
    goods_note: '规格A',
    unit_id: 1,
    default_unit: 1,
    number: 10 + i,
    basic_nmber: 10 + i,
    money: Number(((10 + i) * 12.5).toFixed(2)),
    purchase: 12.5,
    stores_id: 1,
    remark: '',
  }));
}

/**
 * 上游主单列表行（doc-list 模式第一次请求的返回）
 *
 * @param {boolean} isPlan true=生产计划（用 plan 单号字段），false=生产单
 * @returns {any[]}
 */
function upstreamDocs(isPlan) {
  return Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    purchase_code: `${isPlan ? 'SCJH' : 'SCRW'}2026100${i + 1}`,
    plan_code: isPlan ? '' : `SCJH2026100${i + 1}`,
    purchase_time: 1759600000 + i * 86400,
    delivery_time: 1759900000 + i * 86400,
    goods_code: `SP${String(2001 + i)}`,
    goods_name: `产成品 ${i + 1}`,
    number: 50,
    examine_status: 1,
  }));
}

/**
 * 核销源单行（kuyou_writeoff_source 结构 + 后端富化字段）
 *
 * @returns {any[]}
 */
function writeoffSources() {
  return Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    customers_id: 1,
    suppliers_code: 'GYS001',
    purchase_type: i % 2 === 0 ? '普通销售' : '核销',
    purchase_code: `XS2026100${i + 1}`,
    purchase_time: `2026-10-${String(10 + i).padStart(2, '0')}`,
    price: 128.5,
    money_tax_price: 128.5,
    pay_money: 1200 + i * 100,
    money: 1200 + i * 100,
    write_off: 1200 + i * 100,
    purchase_type_id: i + 1,
    purchase_codes: `XS2026100${i + 1}`,
    type: 1,
    remark: '',
  }));
}

/**
 * 生成统一响应体：集合字段一律数组，避免视图 .map/.filter 报错。
 *
 * @param {string} url 请求 URL
 * @returns {string} JSON 字符串
 */
function body(url) {
  const clean = url.split('?')[0];
  // ---------------- 单据「引入源单」链路 ----------------
  // 上游单据选择（源 choselist / choseplan）：无单号返回上游主单列表，有单号返回该单明细
  if (/\/(picking|productions|outsourcing)\/choselist$/.test(clean) || /\/plan\/choseplan$/.test(clean)) {
    const isPlan = /choseplan$/.test(clean);
    const rows = /purchase_code=/.test(url) ? productionLines(0, 4) : upstreamDocs(isPlan);
    return JSON.stringify({ code: 1, data: { total: rows.length, rows }, total: rows.length, rows });
  }
  // 按单号取明细（源 material/acceptance pickinfo、productions/outsourcing planinfo）
  if (/\/(material|acceptance)\/pickinfo$/.test(clean) || /\/(productions|outsourcing)\/planinfo$/.test(clean)) {
    const rows = productionLines(0, 4);
    return JSON.stringify({ code: 1, data: { total: rows.length, rows }, total: rows.length, rows });
  }
  // 核销单源单选择（收款 / 应收 / 应付 / 预付）
  if (/\/writeoff\/chose(list|receivable|copewith|advancelist)$/.test(clean)) {
    const rows = writeoffSources();
    return JSON.stringify({ code: 1, data: { total: rows.length, rows }, total: rows.length, rows });
  }
  // 订单合并入库 / 合并出库：返回可生成的下游明细
  if (/\/goods_(purchase|sales)_order\/checkPurchase$/.test(clean)) {
    const lines = productionLines(0, 3).map((r) => ({ ...r, unit_price: 12.5, all_money: Number((r.number * 12.5).toFixed(2)) }));
    return JSON.stringify({ code: 1, msg: 'ok', data: { code: 'ORDER20261001', lines }, total: lines.length, rows: lines });
  }
  // ---------------- 对账中心 / 汇总报表 ----------------
  // 这两个页面的行样式依赖 purchase_code === '期初余额' / '小计' 与
  // s_name === '小计' / '合计' 的汇总行，假数据必须包含这类行，
  // 否则 rowClass 的高亮分支永远走不到，等于没验证
  if (/\/(customers|suppliers)_recon\/index$/.test(clean)) {
    const rows = [];
    rows.push({
      id: 0,
      purchase_code: '期初余额',
      purchase_time: 1759600000,
      customers_name: '示例客户 A',
      suppliers_name: '示例供应商 A',
      number: 0,
      all_money: 12000,
      money: 12000,
      remark: '期初',
    });
    for (let i = 1; i <= 6; i++) {
      rows.push({
        id: i,
        purchase_code: `SK-2026${String(i).padStart(4, '0')}`,
        purchase_time: 1759600000 + i * 86400,
        customers_name: `示例客户 ${String.fromCharCode(64 + ((i % 3) + 1))}`,
        suppliers_name: `示例供应商 ${String.fromCharCode(64 + ((i % 3) + 1))}`,
        number: 5 + i,
        all_money: (5 + i) * 120.5,
        money: (5 + i) * 120.5,
        remark: `第 ${i} 笔`,
      });
    }
    rows.push({
      id: 99,
      purchase_code: '小计',
      purchase_time: 1759600000 + 7 * 86400,
      customers_name: '—',
      suppliers_name: '—',
      number: 51,
      all_money: 12000 + 51 * 120.5,
      money: 12000 + 51 * 120.5,
      remark: '合计',
    });
    return JSON.stringify({ code: 1, data: { total: rows.length, rows }, total: rows.length, rows });
  }
  if (/\/goods_(purchase|sales)_summary[sc]?\/index$/.test(clean)) {
    const rows = [];
    for (let i = 1; i <= 8; i++) {
      rows.push({
        id: i,
        s_name: `示例商品 ${i}`,
        goods_code: `SP${String(1000 + i)}`,
        number: 20 + i * 4,
        all_money: (20 + i * 4) * 88.6,
        money: (20 + i * 4) * 88.6,
        unit_name: '个',
      });
    }
    // 小计 / 合计行：summary 页 rowClass 靠 s_name 命中并加粗底色
    rows.push({ id: 98, s_name: '小计', goods_code: '—', number: 208, all_money: 208 * 88.6, money: 208 * 88.6 });
    rows.push({ id: 99, s_name: '合计', goods_code: '—', number: 416, all_money: 416 * 88.6, money: 416 * 88.6 });
    return JSON.stringify({ code: 1, data: { total: rows.length, rows }, total: rows.length, rows });
  }
  // 盘点→盘盈/盘亏联动：真实后端返回裸数组 [{type,purchase_code,status,title}]，
  // 这里给两条固定示例，保证「生成盘单单据」弹层能看到按钮
  if (/\/Warehousing\/checkInventory$/.test(clean)) {
    return JSON.stringify([
      { type: 1, purchase_code: 'PD-001', status: 1, title: '盘盈单' },
      { type: 1, purchase_code: 'PD-001', status: 2, title: '盘亏单' },
    ]);
  }
  // 已销订购看板：真实后端按销售订单明细聚合出待采购数量与下单所需行字段，
  // 这里给结构一致的示例，便于在无 MySQL 环境下走通「生成购货单」流程
  // （前端调用 /special/sold-ordered，对应后端源 purchaseby/setdata）
  if (/\/special\/sold-ordered$|\/purchaseby\/setdata$/.test(clean)) {
    const sold = Array.from({ length: Math.min(ROWS, 8) }, (_, i) => {
      const sale = 10 + i * 3;
      const ordered = i % 3 === 0 ? 0 : i * 2;
      return {
        id: i + 1,
        purchase_code: `XS-2026${String(i + 1).padStart(4, '0')}`,
        purchase_time: 1759600000 + i * 86400,
        goods_code: `SP${String(1001 + i)}`,
        goods_name: `示例商品 ${i + 1}`,
        unit_name: '个',
        stores_name: '主仓库',
        customers_name: `客户 ${(i % 4) + 1}`,
        sale_number: sale,
        out_number: Math.max(0, sale - 3),
        sold_number: ordered,
        buy_number: Math.max(0, sale - ordered),
        ordered_code: ordered ? `CG-2026${String(i + 1).padStart(4, '0')}` : '',
        ordered_status: ordered ? '已审核' : '',
        goods_attr: 1,
        goods_unit: 1,
        stores_id: 1,
        customers_id: (i % 4) + 1,
        unit_price: 12.5 + i,
      };
    });
    // 与真实后端一致：ok({ total, rows }) → { code, data: { total, rows } }
    return JSON.stringify({ code: 1, msg: 'ok', data: { total: sold.length, rows: sold }, total: sold.length, rows: sold });
  }
  // /kuyou/<table>/<action>；/kuyou 后面可能还有一层前缀，取倒数第二段作为表名
  const parts = clean.replace(/^\/kuyou\/?/, '').split('/').filter(Boolean);
  const tableKey = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  const table = TABLES[tableKey];
  const rows = Array.from({ length: ROWS }, (_, i) => makeRow(table, i));
  // 设置类表：type 是「配置分组」（1 基础参数 / 2 功能参数 / 3 价格策略），
  // 假数据按 1→2→3 循环，否则每行 type 都不同，页面会渲染成「每项一个分组」。
  if (tableKey === 'kuyou_sets' || tableKey === 'kuyou_user_sets') {
    rows.forEach((r, i) => {
      r.type = (i % 3) + 1;
    });
  }
  return JSON.stringify({
    code: 1,
    msg: 'ok',
    data: rows,
    rows,
    list: rows,
    total: rows.length,
    page: 1,
    limit: 20,
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  const url = req.url || '/';
  if (!url.startsWith('/kuyou')) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, msg: 'mock: 仅处理 /kuyou/**' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body(url));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock 后端已启动 → http://127.0.0.1:${PORT}/kuyou（每接口 ${ROWS} 行按字段类型生成的假数据）`);
});
