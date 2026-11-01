// 端点覆盖审计：源 kuyou PC 端前端调用的全部 kuyou/<模块>/<方法> 与目标 NestJS 路由比对
// 用法：node scripts/audit-endpoints.js
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../../../kuyou-1.2.4-extended');
const BACKEND = path.resolve(__dirname, '..');

/** 目标端通用动态路由（:table 通配）覆盖的动作 */
const GENERIC_ACTIONS = new Set([
  'index',
  'selectpage',
  'detail',
  'add',
  'edit',
  'del',
  'multi', // 批量操作（启用/禁用/删除）
  'import', // 通用导入（按列注释映射表头）
  'recyclebin',
  'restore',
  'destroy',
  'examine', // 单据审核别名
  'audit', // 审核（源端命名 examine 的等价实现）
  'counter',
  'doclist',
  'doc',
  'save',
]);

/** 递归读取目录下所有文件 */
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/* ---------- 1) 源端：抽取前端调用路径 ---------- */
const srcFiles = [
  ...walk(path.join(SRC, 'public/assets/js/backend/kuyou')),
  ...walk(path.join(SRC, 'application/admin/view/kuyou')),
];
/** 静态资源目录名，形如 kuyou/css/kuyou.css 会被正则误判为接口，需排除 */
const ASSET_MODULES = new Set(['css', 'js', 'img', 'images', 'fonts', 'layui', 'libs', 'plugins']);
const srcEndpoints = new Set();
for (const f of srcFiles) {
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(/kuyou\/([A-Za-z_]+)\/([A-Za-z_0-9]+)/g)) {
    if (ASSET_MODULES.has(m[1].toLowerCase())) continue;
    srcEndpoints.add(`kuyou/${m[1]}/${m[2]}`);
  }
}

/* ---------- 2) 目标端：抽取 NestJS 路由 ---------- */
const dstFiles = walk(path.join(BACKEND, 'src'));
const staticRoutes = new Set();
const paramRoutes = [];
for (const f of dstFiles) {
  if (!/\.ts$/.test(f)) continue;
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(/@(Get|Post|Put|Delete|Patch)\(\s*'([^']+)'\s*\)/g)) {
    const route = m[2].replace(/^kuyou\//, '');
    if (route.includes(':')) paramRoutes.push(route);
    else staticRoutes.add(route);
  }
}

/**
 * 判断某源端点是否被目标端覆盖：
 * 1) 命中静态路由；
 * 2) 命中 :table 通配路由且动作属于通用 CRUD；
 * 3) 命中 :table 通配路由（recyclebin/restore/destroy 等新支持的通配动作）。
 */
/**
 * 判断某源端点是否被目标端覆盖。
 * 说明：ThinkPHP/FastAdmin 的控制器与动作名在路由解析时大小写不敏感
 * （kuyou/Acceptance/pickinfo 与 kuyou/acceptance/pickinfo 等价），
 * 因此比对统一按小写归一。
 * 覆盖判定优先级：
 *  1) 命中静态路由；
 *  2) 命中 :table 通配路由且动作属于通用 CRUD；
 *  3) 命中带命名参数的路由（如 goods_purchase/getSuppliers/:code）；
 *  4) 命中首段即参数的路由（如 invoicing 的 :kind/list）。
 */
const covered = [];
const missing = [];
const lower = (s) => String(s || '').toLowerCase();
/** 非接口型路由：这些是纯视图弹窗（FastAdmin 直接渲染 html），不需要后端接口 */
const VIEW_ONLY = new Set(['kuyou/acceptance/acceptance']);

for (const ep of [...srcEndpoints].sort()) {
  if (VIEW_ONLY.has(lower(ep))) { covered.push(ep); continue; }
  const rel = ep.replace(/^kuyou\//, '');
  const seg = rel.split('/');
  const module = lower(seg[0]);
  const action = lower(seg[1]);
  const hitStatic = [...staticRoutes].some((r) => lower(r) === lower(rel));
  if (hitStatic) { covered.push(ep); continue; }
  // :table 通配路由
  const hitParam = paramRoutes.find((r) => r.startsWith(':table/') && lower(r.split('/')[1]) === action);
  if (hitParam && GENERIC_ACTIONS.has(action)) { covered.push(ep); continue; }
  // 带路径参数的路由（如 goods_purchase/getSuppliers/:code 覆盖 getSuppliers）
  const hitNamed = paramRoutes.find((r) => {
    const segs = r.split('/');
    return lower(segs[0]) === module && lower(segs[1]) === action;
  });
  if (hitNamed) { covered.push(ep); continue; }
  // 首段即参数的路由（如 invoicing 模块的 :kind/list）视为对任意模块同名动作的覆盖
  const hitAnyModule = paramRoutes.find((r) => {
    const segs = r.split('/');
    return segs.length === 2 && segs[0].startsWith(':') && lower(segs[1]) === action;
  });
  if (hitAnyModule) { covered.push(ep); continue; }
  missing.push(ep);
}

const rate = ((covered.length / srcEndpoints.size) * 100).toFixed(1);
console.log('源端 PC 前端 kuyou 端点总数:', srcEndpoints.size);
console.log('目标端已覆盖:', covered.length, `(${rate}%)`);
console.log('未覆盖:', missing.length);
if (missing.length) {
  console.log('\n未覆盖明细（按模块分组）:');
  const byModule = {};
  for (const m of missing) {
    const mod = m.split('/')[1];
    (byModule[mod] = byModule[mod] || []).push(m.split('/').slice(2).join('/'));
  }
  for (const mod of Object.keys(byModule).sort()) {
    console.log(`  kuyou/${mod}: ${[...new Set(byModule[mod])].sort().join(', ')}`);
  }
}
