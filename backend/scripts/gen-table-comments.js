// 从 db/schema.sql 抽取「表 → 列注释 → 列名」映射，生成 src/table-comments.ts
// 用途：通用 Excel 导入按表头中文注释匹配字段（FastAdmin 默认导入行为）
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sqlPath = path.resolve(root, '../db/schema.sql');
const outPath = path.join(root, 'src/table-comments.ts');

const sql = fs.readFileSync(sqlPath, 'utf8');
const lines = sql.split(/\r?\n/);

/** 表 → { 注释: 列名 } */
const map = {};
let current = null;

for (const raw of lines) {
  const line = raw.trim();
  // 进入建表语句
  const create = line.match(/^CREATE TABLE (?:IF NOT EXISTS )?`(\w+)`\s*\(/);
  if (create) {
    current = create[1];
    map[current] = map[current] || {};
    continue;
  }
  // 建表结束
  if (/^\)/.test(line)) {
    current = null;
    continue;
  }
  if (!current) continue;
  // 列定义： `col` type ... COMMENT '注释'
  const col = line.match(/^`(\w+)`\s+[^,]*COMMENT\s+'((?:[^']|'')*)'/);
  if (col) {
    const name = col[1];
    const comment = col[2].replace(/''/g, "'").trim();
    if (comment && !map[current][comment]) map[current][comment] = name;
  }
}

// 仅保留 kuyou_ 前缀表
const out = {};
for (const t of Object.keys(map)) {
  if (!/^kuyou_/.test(t)) continue;
  if (!Object.keys(map[t]).length) continue;
  out[t] = map[t];
}

const body =
  '// 自动生成，请勿手改。来源：db/schema.sql 的列 COMMENT\n' +
  '// 通用导入按 Excel 表头（中文注释）匹配数据库列名，与 FastAdmin 默认导入行为一致。\n' +
  '/** 表 → { 列注释: 列名 } */\n' +
  'export const TABLE_COMMENTS: Record<string, Record<string, string>> = ' +
  JSON.stringify(out, null, 2) +
  ';\n';

fs.writeFileSync(outPath, body, 'utf8');
const tables = Object.keys(out).length;
const pairs = Object.values(out).reduce((n, m) => n + Object.keys(m).length, 0);
console.log(`已生成 ${outPath}：${tables} 张表 / ${pairs} 条注释映射`);
