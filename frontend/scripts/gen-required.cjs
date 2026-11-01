#!/usr/bin/env node
/**
 * 从源 kuyou（FastAdmin）表单模板提取「必填字段」规则，生成前端校验配置。
 *
 * 背景：迁移后的通用 CRUD 表单按 db/schema.sql 的列元数据自动生成，
 * 而 NOT NULL / 业务必填规则只存在于源模板的 data-rule="required" 上。
 * 本脚本把 289 个 add/edit 模板里的必填标记抽出来，产出
 * src/config/required-fields.ts，供 crud.vue 与 document.vue 做提交前校验。
 *
 * 用法：
 *   node scripts/gen-required.cjs
 *   KUYOU_SRC=D:/path/to/kuyou-1.2.4-extended node scripts/gen-required.cjs
 *
 * 输出：
 *   src/config/required-fields.ts
 */
const fs = require('fs');
const path = require('path');

/** 源系统根目录（可用环境变量覆盖） */
const SRC = process.env.KUYOU_SRC || 'F:/erp系统/ERP/kuyou-1.2.4-extended';
/** 视图模板目录 */
const VIEW_DIR = path.join(SRC, 'application/admin/view/kuyou');
/** 输出文件 */
const OUT = path.join(__dirname, '../src/config/required-fields.ts');
/** 模块元数据（用于过滤不存在的表） */
const MODULES_TS = path.join(__dirname, '../src/config/modules.ts');

/**
 * 不计入必填校验的字段
 *
 * - 系统字段：由后端自动写入，前端表单不展示
 * - 单号：purchase_code 等由后端按前缀规则生成，留空才正确
 * - 图片：*_image 属 UI 约束（源端要求上传图），迁移后是 URL 文本框，强制必填只会挡路
 */
const SKIP = new Set(['admin_id', 'examine_id', 'operation_id', 'preparation_id', 'createtime', 'updatetime', 'deletetime', 'purchase_code', 'image']);
/** 按后缀排除的字段 */
const SKIP_SUFFIX = [/_image$/];

/**
 * 该字段是否需要参与前端必填校验
 * @param {string} field 字段名
 * @returns {boolean}
 */
function keepField(field) {
  if (SKIP.has(field)) return false;
  return !SKIP_SUFFIX.some((re) => re.test(field));
}

/**
 * 从 HTML 模板中提取必填字段名
 *
 * 覆盖三种源端写法：
 *  1. <input data-rule="required" name="row[xxx]">
 *  2. <textarea data-rule="required" name="row[xxx]">
 *  3. {:build_select('row[xxx]', $list, null, ['data-rule'=>'required'])}
 *
 * @param {string} html 模板内容
 * @returns {string[]} 字段名数组
 */
function extractRequired(html) {
  const out = new Set();

  // 写法 1/2：标签内同时含 name="row[xxx]" 与 data-rule 含 required
  const tagRe = /<(?:input|textarea|select)\b[^>]*>/gi;
  for (const m of html.matchAll(tagRe)) {
    const tag = m[0];
    if (!/data-rule\s*=\s*["'][^"']*required/i.test(tag)) continue;
    const nm = tag.match(/name\s*=\s*["']row\[([a-zA-Z_0-9]+)\]/);
    if (nm) out.add(nm[1]);
  }

  // 写法 3：build_select，name 在 data-rule 之前
  const bsBefore = /build_select\(\s*['"]row\[([a-zA-Z_0-9]+)\]['"][\s\S]{0,300}?data-rule['"]\s*=>\s*['"]required/gi;
  for (const m of html.matchAll(bsBefore)) out.add(m[1]);

  // 写法 3 补充：data-rule 写在 name 之前
  const bsAfter = /build_select\([\s\S]{0,120}?data-rule['"]\s*=>\s*['"]required[\s\S]{0,120}?['"]row\[([a-zA-Z_0-9]+)\]['"]/gi;
  for (const m of html.matchAll(bsAfter)) out.add(m[1]);

  return [...out].sort();
}

/**
 * 读取 modules.ts 里已注册的表名，用于过滤生成结果
 * @returns {Set<string>}
 */
function loadModuleKeys() {
  const s = fs.readFileSync(MODULES_TS, 'utf8');
  const keys = new Set();
  for (const m of s.matchAll(/^ {4}"key": "([a-z_0-9]+)"/gm)) keys.add(m[1]);
  return keys;
}

/**
 * 主流程：遍历视图目录 → 抽取必填 → 写 TS 配置
 */
function main() {
  if (!fs.existsSync(VIEW_DIR)) {
    console.error(`[gen-required] 找不到模板目录：${VIEW_DIR}`);
    process.exit(1);
  }
  const moduleKeys = loadModuleKeys();
  const dirs = fs
    .readdirSync(VIEW_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'retail' && d.name !== 'common');

  /** 表名 → 必填字段 */
  const result = {};
  let scanned = 0;
  for (const d of dirs) {
    const dir = path.join(VIEW_DIR, d.name);
    const files = fs.readdirSync(dir).filter((f) => /^(add|edit)\.html$/.test(f));
    if (!files.length) continue;
    const fields = new Set();
    for (const f of files) {
      const html = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const k of extractRequired(html)) fields.add(k);
    }
    if (!fields.size) continue;
    const table = `kuyou_${d.name}`;
    // 只保留 modules.ts 里真实存在的表，避免生成死配置
    if (!moduleKeys.has(table)) continue;
    // 过滤系统字段 / 单号 / 图片字段
    const kept = [...fields].filter(keepField).sort();
    if (!kept.length) continue;
    result[table] = kept;
    scanned += 1;
  }

  const lines = [];
  lines.push('// 自动生成，请勿手改。来源：kuyou 源系统 application/admin/view/kuyou/*/add|edit.html');
  lines.push('//');
  lines.push('// 记录每个基础资料表的「业务必填字段」（源表单 data-rule="required"）。');
  lines.push('// 通用 CRUD 表单按 db/schema.sql 的列元数据生成，NOT NULL 与业务必填不在元数据里，');
  lines.push('// 因此这里单独维护一份规则，供 crud.vue / document.vue 在提交前拦截空值。');
  lines.push('//');
  lines.push('// 重新生成：node scripts/gen-required.cjs');
  lines.push('');
  lines.push('/** 表名 → 必填字段列表 */');
  lines.push('export const REQUIRED_FIELDS: Record<string, string[]> = {');
  for (const [table, fields] of Object.entries(result)) {
    lines.push(`  ${table}: [${fields.map((f) => `'${f}'`).join(', ')}],`);
  }
  lines.push('};');
  lines.push('');
  lines.push('/**');
  lines.push(' * 取某张表的必填字段');
  lines.push(' * @param table 物理表名');
  lines.push(' * @returns 必填字段数组，无配置返回空数组');
  lines.push(' */');
  lines.push('export function requiredOf(table: string): string[] {');
  lines.push('  return REQUIRED_FIELDS[table] || [];');
  lines.push('}');
  lines.push('');

  fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
  console.log(`[gen-required] 已生成 ${Object.keys(result).length} 张表的必填规则 → ${path.relative(process.cwd(), OUT)}`);
  console.log(`[gen-required] 扫描目录 ${scanned} 个`);
}

main();
