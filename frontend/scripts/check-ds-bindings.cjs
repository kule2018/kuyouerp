/**
 * Ds 组件绑定自检脚本（CommonJS：项目 package.json 为 "type": "module"）。
 *
 * 用途：迁移 Element-Plus → DeepSeek UI 后的安全网。扫描 views/ 与 components/ 模板中
 *       对 Ds* 组件的全部属性绑定（动态 :prop / @event / 静态 prop），
 *       与组件自身 defineProps / defineEmits 声明逐一比对，
 *       揪出残留的 Element 属性名 —— 这类属性在 Vue 中不会被报错，
 *       而是静默透传到根元素，导致功能（如 reserve-selection / min / step）悄悄失效。
 *
 * 用法：node scripts/check-ds-bindings.cjs
 *      或 npm run check:ds
 * 输出：每个组件缺失的 props / emits 清单；全部通过则打印「无失效绑定」。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const DS_DIR = path.join(ROOT, 'components', 'ds');

/** kebab-case 转 camelCase */
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** 保留属性：Vue / HTML 原生，透传即可，不算组件缺失 */
const RESERVED = new Set([
  'key', 'ref', 'class', 'style', 'id', 'title', 'slot', 'is',
  'aria-label', 'role', 'tabindex', 'href', 'target', 'src', 'alt',
]);

/** 原生事件：经根元素冒泡或透传生效，不作为 emits 缺失 */
const RAW_EVENTS = new Set([
  'click', 'dblclick', 'keyup', 'keydown', 'keypress', 'input', 'change',
  'focus', 'blur', 'submit', 'mouseenter', 'mouseleave', 'mousedown', 'mouseup',
  'scroll', 'wheel', 'dragstart', 'dragover', 'drop', 'contextmenu',
  'compositionstart', 'compositionend', 'paste', 'copy', 'cut',
]);

/**
 * 读取单个组件的 props / emits 声明。
 * @param {string} file 组件 .vue 文件路径
 * @returns {{p: Set<string>, e: Set<string>}} props 与 emits 名称集合
 */
function readDeclaration(file) {
  const src = fs.readFileSync(file, 'utf8');
  const props = new Set();
  const emits = new Set();
  // 类型式 defineProps<{...}> 或选项式 defineProps({...})
  const block = src.match(/defineProps\s*<\{[\s\S]*?\n\s{0,4}\}>|defineProps\s*\(\{[\s\S]*?\n\s{0,4}\}\)/);
  if (block) {
    for (const m of block[0].matchAll(/^\s+([a-zA-Z][a-zA-Z0-9]*)\??\s*[:(]/gm)) props.add(m[1]);
  }
  for (const m of src.matchAll(/\(e:\s*'([^']+)'/g)) emits.add(m[1]);
  // defineModel 隐式产生 update:xxx 双向事件
  for (const m of src.matchAll(/defineModel\s*<[^>]*>\s*\(\s*'([a-zA-Z]+)'/g)) emits.add('update:' + m[1]);
  return { p: props, e: emits };
}

/** 收集全部 ds 组件声明 */
const decls = {};
for (const f of fs.readdirSync(DS_DIR)) {
  if (!f.endsWith('.vue')) continue;
  decls[f.replace('.vue', '')] = readDeclaration(path.join(DS_DIR, f));
}

/**
 * 从模板正文里逐个提取 <DsXxx ...> 标签的内容片段（引号感知，
 * 避免属性值中的 ">" 提前截断标签，如 v-if="a > b"）。
 * @param {string} body 模板字符串
 * @returns {{name: string, attrs: string}[]} 标签名与属性区文本
 */
function extractTags(body) {
  const out = [];
  const re = /<(Ds|Base)[A-Za-z]+\b/g;
  let m;
  while ((m = re.exec(body))) {
    let i = re.lastIndex;
    let quote = null;
    while (i < body.length) {
      const ch = body[i];
      if (quote) {
        if (ch === quote) quote = null; // 离开字符串
      } else if (ch === '"' || ch === "'") {
        quote = ch; // 进入字符串
      } else if (ch === '>') {
        break; // 标签结束
      }
      i++;
    }
    out.push({ name: body.slice(m.index + 1, re.lastIndex), attrs: body.slice(re.lastIndex, i) });
    re.lastIndex = i;
  }
  return out;
}

/** 递归收集待检查的 .vue 文件（排除 ds 组件库自身） */
function collect(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) {
      if (path.basename(fp) !== 'ds') collect(fp, out);
    } else if (f.endsWith('.vue')) out.push(fp);
  }
  return out;
}

const missing = {};
for (const fp of [...collect(path.join(ROOT, 'views')), ...collect(path.join(ROOT, 'components'))]) {
  const src = fs.readFileSync(fp, 'utf8');
  const tpl = src.match(/<template>[\s\S]*?\n<\/template>/);
  if (!tpl) continue;

  for (const { name, attrs } of extractTags(tpl[0])) {
    const decl = decls[name];
    if (!decl) continue; // 非 ds 组件或未被纳入索引
    const bucket = () => (missing[name] ??= { p: new Set(), e: new Set() });

    // ---- 动态绑定：:prop= / @event= / v-model:xxx=（连同引号内的表达式整体剔除） ----
    let rest = attrs;
    const dynRe = /(?:^|\s)(?::|@|v-model:)([a-zA-Z-]+)(?:\.[a-z]+(?:-[a-z]+)*)*=(?:"[^"]*"|'[^']*'|[^\s>]+)/g;
    for (const a of attrs.matchAll(dynRe)) {
      const kind = a[0].trim()[0] === '@' ? '@' : ':';
      const raw = a[1];
      const key = camel(raw);
      rest = rest.replace(a[0], ' ');
      if (RESERVED.has(raw) || RESERVED.has(key)) continue;
      if (kind === '@') {
        if (RAW_EVENTS.has(raw)) continue;
        if (!decl.e.has(raw) && !decl.e.has(key) && !decl.e.has('on' + key)) bucket().e.add(raw);
      } else {
        const pk = key.startsWith('modelValue') ? 'modelValue' : key;
        if (!decl.p.has(pk) && !decl.p.has(raw)) bucket().p.add(raw);
      }
    }

    // ---- 静态属性：去掉全部指令后逐个校验 ----
    rest = rest
      .replace(/(?:^|\s)v-[a-zA-Z-]+(?::[a-zA-Z-]+)?(?:\.[a-z]+)?="[^"]*"/g, ' ')
      .replace(/(?:^|\s)v-[a-z-]+(?=\s|$)/g, ' ');
    for (const s of rest.matchAll(/(?:^|\s)([a-zA-Z][a-zA-Z-]*)(?:="[^"]*")?/g)) {
      const raw = s[1];
      const key = camel(raw);
      if (RESERVED.has(raw) || RESERVED.has(key)) continue;
      if (!decl.p.has(key) && !decl.p.has(raw)) bucket().p.add(`${raw}(静态)`);
    }
  }
}

let has = false;
for (const [name, v] of Object.entries(missing)) {
  if (v.p.size) { console.log(`${name} 缺 props: ${[...v.p].join(', ')}`); has = true; }
  if (v.e.size) { console.log(`${name} 缺 emits: ${[...v.e].join(', ')}`); has = true; }
}
if (!has) console.log('无失效绑定 ✓');
process.exit(has ? 1 : 0);
