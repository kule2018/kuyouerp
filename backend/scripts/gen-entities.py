#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 kuyou 的 install.sql 生成 NestJS + TypeORM 实体文件。

功能：
  1. 解析所有 CREATE TABLE（__PREFIX__ 占位符去除，表名保留 kuyou_ 前缀）
  2. 每张表生成一个 src/entities/<snake>.entity.ts
  3. 列：类型映射 / 可空 / 默认值 / 注释 / 主键自增 全部还原
  4. 生成 src/entities/index.ts 统一导出
  5. 同时产出 db/schema.sql（__PREFIX__ 替换为空，表名即 kuyou_xxx）

用法：python scripts/gen-entities.py
"""
import re
import os

SRC_SQL = r"F:/erp系统/ERP/kuyou-1.2.4-extended/install.sql"
OUT_DIR = r"F:/erp系统/ERP/kuyou-nestjs-vue/backend/src/entities"
SCHEMA_OUT = r"F:/erp系统/ERP/kuyou-nestjs-vue/db/schema.sql"
PREFIX = "__PREFIX__"

# ---------- 工具函数 ----------
def snake_to_camel(name: str) -> str:
    parts = name.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])

def table_to_class(table: str) -> str:
    # 去 __PREFIX__ 后，再去掉常见的 kuyou_ 模块前缀，得到简洁类名
    t = table
    if t.startswith(PREFIX):
        t = t[len(PREFIX):]
    if t.startswith("kuyou_"):
        t = t[len("kuyou_"):]
    return "".join(w.capitalize() for w in t.split("_"))

def map_type(mysql_type: str):
    """返回 (typeorm_type, ts_type, length_or_precision)"""
    m = re.match(r"(\w+)\s*(\([^)]*\))?", mysql_type.strip())
    base = (m.group(1) or "").lower()
    inner = (m.group(2) or "").strip("() ")
    if base in ("int", "integer"):
        return ("int", "number", None)
    if base == "tinyint":
        return ("tinyint", "number", None)
    if base in ("smallint", "mediumint"):
        return ("int", "number", None)
    if base == "bigint":
        return ("bigint", "number", None)
    if base in ("varchar", "char"):
        length = int(inner) if inner.isdigit() else 255
        return ("varchar", "string", length)
    if base in ("text", "tinytext", "mediumtext", "longtext"):
        return ("text", "string", None)
    if base == "double":
        return ("double", "number", None)
    if base == "float":
        return ("float", "number", None)
    if base in ("decimal", "numeric"):
        parts = inner.split(",")
        prec = int(parts[0]) if parts and parts[0].isdigit() else 15
        scale = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 2
        return ("decimal", "number", (prec, scale))
    if base in ("date", "datetime", "timestamp", "time", "year"):
        return ("datetime", "Date", None)
    if base in ("enum", "set"):
        return ("varchar", "string", 255)
    if base == "json":
        return ("json", "object", None)
    if base in ("blob", "mediumblob", "longblob", "tinyblob"):
        return ("blob", "Buffer", None)
    return ("varchar", "string", 255)

# ---------- 解析列 ----------
COL_RE = re.compile(
    r"^\s*`(?P<name>[^`]+)`\s+(?P<type>\w+(\([^)]*\))?)"
    r"(?P<rest>[^\n]*)"
)

def parse_column(line: str):
    m = COL_RE.match(line)
    if not m:
        return None
    name = m.group("name")
    raw_type = m.group("type")
    rest = m.group("rest")
    if "PRIMARY KEY" in rest and "AUTO_INCREMENT" not in rest and name.lower() != "id":
        pass
    # 是否为自增主键
    auto = "AUTO_INCREMENT" in rest
    not_null = bool(re.search(r"\bNOT NULL\b", rest))
    nullable = not not_null
    # 默认值
    default = None
    dm = re.search(r"DEFAULT\s+(CURRENT_TIMESTAMP|NULL|'[^']*'|[^\s,]+)", rest)
    if dm:
        dv = dm.group(1)
        if dv == "CURRENT_TIMESTAMP":
            default = None  # 函数型默认不写
        elif dv == "NULL":
            default = None
        elif dv.startswith("'"):
            default = dv.strip("'")
        else:
            try:
                default = int(dv)
            except ValueError:
                try:
                    default = float(dv)
                except ValueError:
                    default = dv
    # 注释
    comment = ""
    cm = re.search(r"COMMENT\s+'([^']*)'", rest)
    if cm:
        comment = cm.group(1)
    ttype, ts_type, extra = map_type(raw_type)
    return {
        "name": name,
        "prop": snake_to_camel(name),
        "ttype": ttype,
        "ts": ts_type,
        "extra": extra,
        "auto": auto,
        "nullable": nullable,
        "default": default,
        "comment": comment,
    }

# ---------- 解析整张表 ----------
def parse_table(block: str):
    hm = re.search(r"CREATE TABLE\s+IF NOT EXISTS\s+`?" + re.escape(PREFIX) + r"([A-Za-z0-9_]+)`?", block)
    if not hm:
        # 兜底：不带前缀
        hm = re.search(r"CREATE TABLE\s+IF NOT EXISTS\s+`?([A-Za-z0-9_]+)`?", block)
    if not hm:
        return None, None
    table = hm.group(1)
    # 列定义行：以 ` 开头且不是约束行
    columns = []
    pk_auto = None
    for line in block.splitlines():
        if line.strip().startswith("`"):
            col = parse_column(line)
            if col:
                columns.append(col)
                if col["auto"]:
                    pk_auto = col["name"]
        elif re.search(r"PRIMARY KEY\s*\(", line):
            # 行内 PRIMARY KEY (`id`) 也可能出现在约束行
            km = re.search(r"PRIMARY KEY\s*\(`?([A-Za-z0-9_]+)`?\)", line)
            if km and not pk_auto:
                pk_auto = km.group(1)
    return table, columns, pk_auto

# ---------- 生成实体文件 ----------
def gen_entity(table: str, columns: list, pk_auto: str):
    cls = table_to_class(table)
    lines = []
    lines.append('import { Entity, Column, PrimaryGeneratedColumn } from \'typeorm\';')
    lines.append('')
    lines.append('/**')
    if columns and columns[0]["comment"]:
        lines.append(f' * 表 {table} —— 由 install.sql 自动生成（一比一还原字段）')
    lines.append(f' * 对应原 kuyou 表：{table}')
    lines.append(' */')
    lines.append(f'@Entity(\'{table}\')')
    lines.append(f'export class {cls} {{')
    # 主键
    pk_col = next((c for c in columns if c["name"] == (pk_auto or 'id')), None)
    if pk_col is None and columns:
        # 没有找到自增主键则默认 id
        pk_col = next((c for c in columns if c["name"] == "id"), columns[0])
    for c in columns:
        if c is pk_col and (c["auto"] or c["name"] == "id"):
            lines.append('')
            lines.append('  /** 主键（自增） */')
            lines.append('  @PrimaryGeneratedColumn()')
            lines.append(f'  {c["prop"]}: number;')
            continue
        # 装饰器参数
        opts = [f"name: '{c['name']}'", f"type: '{c['ttype']}'"]
        if c["ttype"] == "varchar" and c["extra"]:
            opts.append(f"length: {c['extra']}")
        if c["ttype"] == "decimal" and c["extra"]:
            prec, scale = c["extra"]
            opts.append(f"precision: {prec}, scale: {scale}")
        opts.append(f"nullable: {str(c['nullable']).lower()}")
        if c["default"] is not None:
            if isinstance(c["default"], str):
                opts.append(f"default: '{c['default']}'")
            else:
                opts.append(f"default: {c['default']}")
        if c["comment"]:
            opts.append(f"comment: '{c['comment'].replace(chr(39), chr(92)+chr(39))}'")
        lines.append('')
        if c["comment"]:
            lines.append(f'  /** {c["comment"]} */')
        lines.append(f'  @Column({{ {", ".join(opts)} }})')
        lines.append(f'  {c["prop"]}: {c["ts"]};')
    lines.append('}')
    lines.append('')
    return "\n".join(lines), cls

# ---------- 主流程 ----------
def main():
    with open(SRC_SQL, "r", encoding="utf-8", errors="ignore") as f:
        sql = f.read()

    # 按 CREATE TABLE 分块（每块到 ENGINE= 结束）
    blocks = re.split(r"(?=CREATE TABLE\s+IF NOT EXISTS)", sql)
    os.makedirs(OUT_DIR, exist_ok=True)

    entities = []
    count = 0
    barrel = []
    for blk in blocks:
        if not blk.strip().upper().startswith("CREATE TABLE"):
            continue
        if "ENGINE=" not in blk.upper():
            # 兜底切到行尾
            end = blk.find(";")
            blk = blk[: end + 1] if end != -1 else blk
        else:
            end = blk.upper().find("ENGINE=")
            blk = blk[:end]
        table, columns, pk_auto = parse_table(blk)
        if not table or not columns:
            continue
        content, cls = gen_entity(table, columns, pk_auto)
        fname = table.replace(PREFIX, "") + ".entity.ts"
        with open(os.path.join(OUT_DIR, fname), "w", encoding="utf-8") as out:
            out.write(content)
        barrel.append(f"export * from './{fname.replace('.ts','')}';")
        entities.append((table, cls))
        count += 1

    with open(os.path.join(OUT_DIR, "index.ts"), "w", encoding="utf-8") as out:
        out.write("// 自动生成的全部 kuyou 实体统一导出\n")
        out.write("\n".join(barrel) + "\n")

    # 生成适配后的 schema.sql（__PREFIX__ 去除，表名即 kuyou_xxx）
    schema = sql.replace(PREFIX, "")
    with open(SCHEMA_OUT, "w", encoding="utf-8") as out:
        out.write(schema)

    print(f"已生成 {count} 个实体到 {OUT_DIR}")
    print(f"已写出适配 schema.sql 到 {SCHEMA_OUT}")

if __name__ == "__main__":
    main()
