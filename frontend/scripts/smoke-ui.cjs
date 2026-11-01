/**
 * UI 运行时冒烟自检（CommonJS：项目 package.json 为 "type": "module"）。
 *
 * 背景：全站由 Element-Plus 迁移到自建 DeepSeek UI 后，vue-tsc 只能保证静态类型，
 *       组件未注册、模板取值错误、属性语义不符等运行时问题它抓不到。
 *
 * 做法：驱动本机 Edge 打开 dev server ——
 *   1) 注入假 token 绕过登录守卫；
 *   2) 拦截所有 /kuyou/** 接口，返回通用空数据信封（不依赖本机 MySQL / 后端）；
 *   3) 通过浏览器动态 import 拿到前端配置真源（modules / documents / reports），
 *      拼出全量真实路由（所有 CRUD 表 + 所有单据 + 所有报表 + 固定页面），逐个访问；
 *   4) 收集 console.error 与未捕获异常，按页面汇总。
 *
 * 用法：
 *   1) 另开终端启动前端：npm run dev
 *   2) node scripts/smoke-ui.cjs [baseURL]
 * 依赖：playwright-core（devDependency）+ 本机 Edge
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { chromium } = require('playwright-core');
const esbuild = require('esbuild');

const CONFIG_DIR = path.join(__dirname, '..', 'src', 'config');

/**
 * 用 esbuild 把前端配置文件即时转译为 CJS 并求值，拿到导出对象。
 * 这样「冒烟路由清单」直接取自 configs 真源，避免脚本里硬编码路由导致覆盖不全。
 *
 * @param {string} file 绝对/相对路径的 .ts 配置文件
 * @returns {Record<string, any>} 该模块的导出对象
 */
function loadConfig(file) {
  const code = esbuild.transformSync(fs.readFileSync(file, 'utf8'), {
    loader: 'ts',
    format: 'cjs',
  }).code;
  const m = new Module(file, null);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(code, file);
  return m.exports;
}

/** 可执行的 Edge 路径（可用环境变量 EDGE_PATH 覆盖） */
const EDGE =
  process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
/** 待巡检的前端地址 */
const BASE = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');

/**
 * 返回裸数组（而非 {code,data} 信封）的后端端点。
 * 取自 src/api/*.ts 中声明为 request.get<T[]>(...) 的接口 —— 目前仅此一个。
 * 若将来新增同类端点，需同步此处，否则会被误判为运行时错误（假阳性）。
 */
const ARRAY_ENDPOINTS = [/\/prints\/types(\?|$)/];

/** 通用信封响应体：字段冗余覆盖后端各类返回形态（{code,data} / {total,rows} / {list}） */
function envelope() {
  // data 取数组：绝大多数列表类接口返回 {code,data:[...]}，视图会直接 .map/.find/.filter；
  // 若塞成对象会制造「假阳性」崩溃。个别返回 data:{...} 的接口取属性得到 undefined，不会抛错。
  return JSON.stringify({
    code: 1,
    msg: 'ok',
    data: [],
    total: 0,
    rows: [],
    list: [],
  });
}

/**
 * 按端点返回形态生成 mock 响应体。
 * @param {string} url 被拦截的请求 URL
 * @returns {string} JSON 字符串
 */
function mockBody(url) {
  return ARRAY_ENDPOINTS.some((re) => re.test(url)) ? '[]' : envelope();
}

/** 无参数的固定页面路由（取自 router/index.ts 与 layout.vue 的菜单定义） */
const STATIC_ROUTES = [
  '/dashboard', '/ai', '/prints', '/intercourse', '/recon', '/summary',
  '/datainfo', '/pos', '/bom',
  '/special/mrp', '/special/replenishment', '/special/sold',
  '/special/wages', '/special/checkout', '/special/init',
  '/invoicing/purchase', '/invoicing/sales',
  // 设置类专用页（不走 /crud/:table，由独立视图承载）
  '/settings/system', '/settings/user', '/prefix',
];

/** 判定为「环境噪声」而非页面缺陷的报错 */
const NOISE = [
  /favicon/i,
  /ResizeObserver loop/i,
  /Download the Vue Devtools/i,
  /Failed to load resource/i,
  /\[vite\]/i,
];

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // 注入登录态：早于应用脚本执行，避免路由守卫把页面弹回 /login
  await ctx.addInitScript(() => {
    localStorage.setItem('token', 'smoke-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, username: 'admin', nickname: '冒烟测试' }));
  });

  // 拦截后端接口，返回空数据；其余请求放行
  await ctx.route('**/kuyou/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: mockBody(route.request().url()),
    }),
  );

  const page = await ctx.newPage();
  const errors = [];
  const push = (url, kind, text) => {
    if (NOISE.some((r) => r.test(text))) return;
    errors.push({ url, kind, text });
  };
  page.on('console', (m) => {
    if (m.type() === 'error') push(page.url(), 'console', m.text());
  });
  page.on('pageerror', (e) => push(page.url(), 'pageerror', String((e && e.message) || e)));

  console.log(`启动浏览器 → ${BASE}`);
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);

  // ---- 从前端配置真源拼出全量路由 ----
  const mods = loadConfig(path.join(CONFIG_DIR, 'modules.ts'));
  const docs = loadConfig(path.join(CONFIG_DIR, 'documents.ts'));
  const rpts = loadConfig(path.join(CONFIG_DIR, 'reports.ts'));
  const links = [
    ...STATIC_ROUTES,
    ...(mods.MODULES || []).filter((m) => m.key).map((m) => '/crud/' + m.key),
    ...(docs.DOCUMENTS || []).filter((d) => d.key).map((d) => '/doc/' + d.key),
    ...(rpts.REPORT_META || []).filter((r) => r.key).map((r) => '/report/' + r.key),
  ].filter((v, i, a) => a.indexOf(v) === i);
  console.log(`配置解析出 ${links.length} 条路由，开始逐页巡检…\n`);

  // ---- 逐页访问 ----
  // 注意：视图是懒加载 chunk，且 modules.ts 体量巨大，dev 下首次编译可能耗时数秒，
  //      因此必须轮询等待挂载完成，不能用固定 sleep 草率判定「渲染失败」。
  let bad = 0;
  let done = 0;
  for (const href of links) {
    const before = errors.length;
    const start = Date.now();
    let len = 0;
    try {
      await page.goto(BASE + href, { waitUntil: 'load', timeout: 30000 });
      await page.waitForFunction(
        () => {
          const app = document.getElementById('app');
          return !!(app && app.textContent && app.textContent.trim().length > 5);
        },
        { timeout: 8000 },
      );
      len = await page.evaluate(() => document.getElementById('app').textContent.trim().length);
    } catch (e) {
      const msg = String((e && e.message) || e).split('\n')[0];
      // 已渲染出内容只是稍慢：不算失败；超时且无内容才算
      len = await page
        .evaluate(() => {
          const app = document.getElementById('app');
          return app && app.textContent ? app.textContent.trim().length : 0;
        })
        .catch(() => 0);
      if (len <= 5) errors.push({ url: href, kind: 'empty', text: `#app 未挂载（${msg.slice(0, 80)}）` });
    }
    if (errors.length > before) {
      bad++;
      const last = errors[errors.length - 1];
      console.log(`  ✗ ${href}\n      [${last.kind}] ${last.text.slice(0, 160)}`);
    }
    if (++done % 50 === 0) console.log(`  … 已巡检 ${done}/${links.length}（累计 ${Date.now() - start}ms/页量级）`);
  }

  await browser.close();

  // ---- 汇总 ----
  console.log('\n================ 冒烟结果 ================');
  console.log(`巡检页面：${links.length}    异常页面：${bad}`);
  if (errors.length) {
    const by = {};
    for (const e of errors) (by[e.kind] ??= []).push(`${e.url} :: ${e.text.slice(0, 200)}`);
    for (const [k, v] of Object.entries(by)) {
      console.log(`\n--- ${k} (${v.length}) ---`);
      v.slice(0, 60).forEach((x) => console.log('  ' + x));
    }
    process.exit(1);
  }
  console.log('全部页面挂载正常，无 console 错误 / 未捕获异常 ✓');
})().catch((e) => {
  console.error('冒烟脚本自身异常：', e);
  process.exit(2);
});
