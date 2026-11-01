// 页面覆盖审计：源 kuyou 管理后台视图目录 ↔ 目标前端 modules.ts 的模块清单
// 用法：node scripts/audit-pages.js
const fs = require('fs');
const path = require('path');

const SRC_VIEWS = path.resolve(__dirname, '../../../kuyou-1.2.4-extended/application/admin/view/kuyou');
const FRONTEND_MODULES = path.resolve(__dirname, '../../frontend/src/config/modules.ts');
const FRONTEND_DOCUMENTS = path.resolve(__dirname, '../../frontend/src/config/documents.ts');

/** 递归读取目录 */
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/* ---------- 1) 源端：视图目录 = 后台页面模块 ---------- */
const srcModules = fs
  .readdirSync(SRC_VIEWS)
  .filter((d) => fs.statSync(path.join(SRC_VIEWS, d)).isDirectory())
  .sort();
const srcViewCount = walk(SRC_VIEWS).filter((f) => f.endsWith('.html')).length;

/* ---------- 2) 目标端：modules.ts 的 key ---------- */
const modTxt = fs.readFileSync(FRONTEND_MODULES, 'utf8');
const modKeys = new Set();
for (const m of modTxt.matchAll(/"key":\s*"([^"]+)"/g)) modKeys.add(m[1]);

/* ---------- 3) 目标端：documents.ts 的单据 key ---------- */
const docTxt = fs.readFileSync(FRONTEND_DOCUMENTS, 'utf8');
const docKeys = new Set();
for (const m of docTxt.matchAll(/key:\s*'([^']+)'/g)) docKeys.add(m[1]);
for (const m of docTxt.matchAll(/header:\s*'([^']+)'/g)) docKeys.add(m[1]);
for (const m of docTxt.matchAll(/"key":\s*"([^"]+)"/g)) docKeys.add(m[1]);
for (const m of docTxt.matchAll(/"header":\s*"([^"]+)"/g)) docKeys.add(m[1]);

/**
 * 专用页面映射：源端视图目录 → 目标端专用 Vue 页面
 * 这些页面不是标准单表 CRUD（有跨表聚合/多 tab），由独立路由承载。
 * key 为源端 view/kuyou/<dir>，value 为前端对应文件。
 */
const CUSTOM_PAGES = {
  acceptances: 'views/document.vue',        // 验收单（主从单据引擎）
  customers_recon: 'views/recon.vue',        // 客户对账单
  suppliers_recon: 'views/recon.vue',        // 供应商对账单
  goods_log_summary: 'views/recon.vue',      // 商品收发明细汇总
  goods_serial_status: 'views/recon.vue',    // 序列号状态
  goods_purchase_summarys: 'views/summary.vue', // 采购汇总（按供应商）
  goods_sales_summarys: 'views/summary.vue',    // 销货汇总（按业务员）
  goods_sales_summaryc: 'views/summary.vue',    // 销货汇总（按客户）
  revenue: 'views/summary.vue',              // 收入支出报表
  salesprofit: 'views/summary.vue',          // 销售利润
  profit: 'views/summary.vue',               // 经营利润
  datainfo: 'views/datainfo.vue',            // 数据中心
  intercourse: 'views/intercourse.vue',      // 往来欠款
  prints: 'views/prints.vue',                // 打印中心
  retail: 'views/pos.vue',                    // POS 收银台（零售结算，order_type=2）
  productions: 'views/document.vue',         // 生产单（单据引擎）
  wages: 'views/special.vue',                // 计件工资
  wageshour: 'views/special.vue',            // 计时工资
  mrps: 'views/special.vue',                 // MRP 计算
  purchaseby: 'views/special.vue',           // 已销订购
  replenishment: 'views/special.vue',        // 智能补货
  initialization: 'views/special.vue',       // 系统初始化
  procedure: 'views/crud.vue',               // BOM 工序（kuyou_bom_procedure 通用 CRUD）
  enclosuresale: 'views/crud.vue',           // 附件记录（kuyou_enclosure_log 通用 CRUD）
  bom: 'views/bom.vue',                      // BOM 配方管理
  common: '(公共模板 include，非页面)',
};

/** 比对结果分三类：已覆盖 / 专用页面 / 未覆盖 */
const covered = [];
const missing = [];
const custom = [];
for (const mod of srcModules) {
  // 前端模块 key 可能带 kuyou_ 前缀，也可能就是裸表名；单据页走 documents.ts
  if (modKeys.has(mod) || modKeys.has(`kuyou_${mod}`) || docKeys.has(mod) || docKeys.has(`kuyou_${mod}`)) {
    covered.push(mod);
  } else if (CUSTOM_PAGES[mod]) {
    custom.push(mod);
  } else {
    missing.push(mod);
  }
}

const rate = (((covered.length + custom.length) / srcModules.length) * 100).toFixed(1);
console.log('源端后台页面模块（视图目录）:', srcModules.length);
console.log('源端视图文件总数（含 add/edit/index 等）:', srcViewCount);
console.log('前端 modules.ts 模块数:', modKeys.size, '| documents.ts 单据数:', docKeys.size);
console.log('已覆盖:', covered.length + custom.length, `(${rate}%)`, `[通用 ${covered.length} + 专用页面 ${custom.length}]`);
console.log('未覆盖:', missing.length);
if (custom.length) console.log('\n专用页面映射:\n  ' + custom.map((m) => `${m} → ${CUSTOM_PAGES[m]}`).join('\n  '));
if (missing.length) console.log('\n未覆盖明细:\n ', missing.join('\n  '));
