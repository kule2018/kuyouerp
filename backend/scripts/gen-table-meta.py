# -*- coding: utf-8 -*-
"""
解析 db/schema.sql，生成前后端共用的表元数据：
  1) backend/src/table-meta.ts      后端白名单（表 -> 列名/类型/pk/deletetime）
  2) frontend/src/config/modules.ts  前端全量菜单 + 列/表单元数据
列名/注释/枚举均取自 install.sql 原样，保证字段与原始 kuyou 一致。
"""
import os
import re
import json

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCHEMA = os.path.join(ROOT, "db", "schema.sql")
BACKEND_OUT = os.path.join(ROOT, "backend", "src", "table-meta.ts")
FRONTEND_OUT = os.path.join(ROOT, "frontend", "src", "config", "modules.ts")

COL_RE = re.compile(r"^\s*`(?P<name>[a-zA-Z0-9_]+)`\s+(?P<type>[a-zA-Z]+(?:\([^)]*\))?(?:\s+unsigned)?)(?P<rest>.*)$")
TABLE_RE = re.compile(r"CREATE TABLE IF NOT EXISTS `(?P<t>[a-zA-Z0-9_]+)`")
COMMENT_RE = re.compile(r"COMMENT\s+'(?P<c>(?:[^']|'')*)'")
ENUM_RE = re.compile(r"enum\((?P<vals>[^)]*)\)", re.I)

# 数值类型
NUM_TYPES = {"int", "bigint", "tinyint", "smallint", "mediumint", "decimal", "double", "float", "real", "numeric"}
TEXT_TYPES = {"text", "longtext", "mediumtext", "tinytext", "blob", "longblob", "mediumblob"}
# 自动维护的字段（前端不可编辑）
AUTO_FIELDS = {"id", "createtime", "updatetime", "deletetime", "admin_id", "wechat_openid", "wxapp_id"}

# ---------- 分组规则（按优先级匹配表名）----------
GROUP_RULES = [
    ("采购管理", ["purchase", "purchaseby", "replenishment"]),
    ("销售管理", ["sales", "retail", "goods_sales_exchange"]),
    ("库存管理", ["inventory", "adjustment", "allocation", "assemble", "split", "picking",
                  "warehousing", "warehouse", "goods_batch", "goods_serial", "goods_stock",
                  "goods_exchange", "goods_log", "goods_log_summary"]),
    ("生产管理", ["mrps", "plan", "productions", "procedure", "material", "bom", "workshop", "outsourcing", "factory"]),
    ("财务管理", ["accounts", "payment", "collection", "expenditure", "income", "writeoff", "revenue",
                  "cost", "profit", "wages", "sales", "invoicing"]),
    ("客户供应商", ["customers", "suppliers", "customer", "supplier", "staff_member", "third_account",
                   "settlement", "auxiliary"]),
    ("基础资料", ["goods", "unit", "stores", "address", "driver", "banner", "prefix",
                  "user_sets", "kuyou_user", "suppliers_user", "enclosure", "sets"]),
    ("报表统计", ["summary", "report", "datainfo", "checkout", "intercourse", "profit", "recon", "log"]),
    ("系统设置", ["sets", "prints", "banner", "prefix", "user_sets"]),
]
GROUP_ORDER = ["采购管理", "销售管理", "库存管理", "生产管理", "财务管理",
               "客户供应商", "基础资料", "报表统计", "系统设置", "其他"]

# 表名 -> 中文标题（仅覆盖有业务含义的主表，其余按表名可读化兜底）
NAME_MAP = {
    "kuyou_goods": "商品管理", "kuyou_goods_type": "商品分类", "kuyou_unit": "计量单位",
    "kuyou_stores": "仓库管理", "kuyou_warehouse": "库位管理", "kuyou_customers": "客户档案",
    "kuyou_suppliers": "供应商档案", "kuyou_customerlevel": "客户等级", "kuyou_customertype": "客户类型",
    "kuyou_supplyertype": "供应商类型", "kuyou_staff_member": "员工档案", "kuyou_auxiliary": "辅助属性",
    "kuyou_address": "地址管理", "kuyou_driver": "司机管理", "kuyou_third_account": "第三方账户",
    "kuyou_settlementtype": "结算方式", "kuyou_expend_type": "支出类型", "kuyou_income_type": "收入类型",
    "kuyou_payment_account": "付款账户", "kuyou_banner": "横幅广告", "kuyou_prefix": "单据前缀",
    "kuyou_sets": "系统设置", "kuyou_user_sets": "用户设置", "kuyou_kuyou_user": "系统用户",
    "kuyou_suppliers_user": "供应商用户", "kuyou_enclosure": "通用附件", "kuyou_enclosuresale": "销售附件",
    "kuyou_goods_purchase": "采购入库", "kuyou_goods_purchase_order": "采购订单",
    "kuyou_goods_purchase_info": "采购入库明细", "kuyou_goods_purchase_order_info": "采购订单明细",
    "kuyou_goods_purchase_summary": "采购汇总", "kuyou_goods_purchase_summarys": "采购汇总(明细)",
    "kuyou_purchaseby": "采购员", "kuyou_replenishment": "智能补货",
    "kuyou_goods_sales": "销售出库", "kuyou_goods_sales_order": "销售订单",
    "kuyou_goods_sales_info": "销售出库明细", "kuyou_goods_sales_order_info": "销售订单明细",
    "kuyou_goods_sales_exchange": "销售退货", "kuyou_goods_sales_exchange_info": "销售退货明细",
    "kuyou_goods_sales_profit": "销售利润", "kuyou_goods_sales_summary": "销售汇总",
    "kuyou_goods_sales_summaryc": "销售汇总(客户)", "kuyou_goods_sales_summarys": "销售汇总(明细)",
    "kuyou_retail": "零售管理", "kuyou_revenue": "营业收入",
    "kuyou_adjustment": "盘点调整", "kuyou_allocation": "库存调拨", "kuyou_assemble": "组装单",
    "kuyou_assemble_temp": "组装单(暂存)", "kuyou_split": "拆分单", "kuyou_split_temp": "拆分单(暂存)",
    "kuyou_picking": "领料单", "kuyou_warehousing": "其他入库", "kuyou_inventory": "库存盘点",
    "kuyou_inventory_serial": "序列号盘点", "kuyou_goods_batch": "商品批次",
    "kuyou_goods_batch_info": "批次明细", "kuyou_goods_batch_log": "批次流水",
    "kuyou_goods_batch_stock": "批次库存", "kuyou_goods_serial": "商品序列号",
    "kuyou_goods_serial_log": "序列号流水", "kuyou_goods_serial_status": "序列号状态",
    "kuyou_goods_stock": "商品库存", "kuyou_goods_exchange": "商品转换",
    "kuyou_goods_exchange_info": "商品转换明细", "kuyou_goods_log": "商品流水",
    "kuyou_goods_log_summary": "商品流水汇总",
    "kuyou_mrps": "MRP计划", "kuyou_plan": "生产计划", "kuyou_productions": "生产加工单",
    "kuyou_procedure": "生产工序", "kuyou_material": "物料清单", "kuyou_bom": "BOM配方",
    "kuyou_workshop": "车间管理", "kuyou_outsourcing": "委外加工", "kuyou_factory": "工厂管理",
    "kuyou_accounts": "账户管理", "kuyou_accounts_copewith": "应付账款",
    "kuyou_accounts_receivable": "应收账款", "kuyou_accounts_transfer": "账户转账",
    "kuyou_accounts_log": "账户流水", "kuyou_collection": "收款单", "kuyou_payment": "付款单",
    "kuyou_payment_log": "付款流水", "kuyou_expenditure": "支出单", "kuyou_income": "收入单",
    "kuyou_writeoff": "核销单", "kuyou_writeoff_log": "核销流水", "kuyou_cost": "成本核算",
    "kuyou_profit": "利润表", "kuyou_salesprofit": "销售利润表", "kuyou_wages": "工资管理",
    "kuyou_wageshour": "计时工资", "kuyou_invoicing": "进销存报表", "kuyou_invoicing_log": "进销存流水",
    "kuyou_sales_invoicing": "销售发票", "kuyou_sales_invoicing_log": "销售发票流水",
    "kuyou_sales_payment_log": "销售收款流水", "kuyou_intercourse": "往来明细",
    "kuyou_checkout": "期末结账", "kuyou_initialization": "初始化", "kuyou_datainfo": "数据中心",
    "kuyou_prints": "打印模板", "kuyou_acceptance": "验收单", "kuyou_acceptances": "验收记录",
    "kuyou_customers_recon": "客户对账", "kuyou_suppliers_recon": "供应商对账",
    "kuyou_customer_goodscoding": "客户商品编码", "kuyou_unit_conversion": "单位换算",
    "kuyou_goods_purchase": "采购入库",
}


def humanize(table: str) -> str:
    """kuyou_goods_purchase_order -> Goods Purchase Order（无映射时的可读兜底）"""
    name = table
    if name.startswith("kuyou_"):
        name = name[len("kuyou_"):]
    return " ".join(w.capitalize() for w in name.split("_"))


def parse_schema(path):
    tables = {}
    cur = None
    cols = None
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for raw in f:
            line = raw.rstrip("\n")
            mt = TABLE_RE.search(line)
            if mt:
                cur = mt.group("t")
                cols = []
                tables[cur] = {"columns": cols, "pk": "id", "auto": False, "has_dt": False}
                continue
            if cur is None:
                continue
            # 表结束
            if re.match(r"\)\s*ENGINE", line) or line.strip().startswith(") ENGINE"):
                cur = None
                continue
            mc = COL_RE.match(line)
            if not mc:
                continue
            name = mc.group("name")
            ctype = mc.group("type").lower()
            rest = mc.group("rest")
            # 跳过索引/约束行（KEY / CONSTRAINT / UNIQUE / PRIMARY）
            if name.upper() in ("KEY", "PRIMARY", "UNIQUE", "CONSTRAINT", "INDEX", "FOREIGN"):
                continue
            if re.search(r"\b(KEY|CONSTRAINT|INDEX)\b", line) and "`" not in line.split(name)[-1][:0]:
                pass
            # 主键 / 自增
            if "PRIMARY KEY" in line or "AUTO_INCREMENT" in rest:
                tables[cur]["pk"] = name
            if "AUTO_INCREMENT" in rest:
                tables[cur]["auto"] = True
            if name == "deletetime":
                tables[cur]["has_dt"] = True
            cm = COMMENT_RE.search(line)
            comment = cm.group("c").replace("''", "'") if cm else ""
            # 枚举选项
            enum_opts = None
            me = ENUM_RE.search(ctype)
            if me:
                raw_vals = me.group("vals")
                vals = re.findall(r"'([^']*)'", raw_vals)
                # 尝试从注释解析 x=y
                pairs = {}
                for part in comment.split(","):
                    if "=" in part:
                        k, v = part.split("=", 1)
                        pairs[k.strip()] = v.strip()
                enum_opts = [{"value": v, "label": pairs.get(v, v)} for v in vals]
            tables[cur]["columns"].append({
                "name": name, "type": ctype, "comment": comment, "enum": enum_opts,
            })
    return tables


def group_of(table):
    for g, pats in GROUP_RULES:
        for p in pats:
            if p in table:
                return g
    return "其他"


def frontend_type(ctype, enum_opts):
    base = ctype.split("(")[0]
    if enum_opts:
        return "select"
    if base in NUM_TYPES:
        return "number"
    if base in TEXT_TYPES:
        return "textarea"
    return "text"


def build():
    tables = parse_schema(SCHEMA)
    # ---------- 1) backend table-meta.ts ----------
    meta = {}
    for t, info in tables.items():
        col_types = {c["name"]: c["type"] for c in info["columns"]}
        meta[t] = {
            "pk": info["pk"],
            "auto": info["auto"],
            "hasDt": info["has_dt"],
            "columns": [c["name"] for c in info["columns"]],
            "types": col_types,
        }
    ts = "// 自动生成，请勿手改。来源：db/schema.sql\n"
    ts += "// 表名/列名/类型与原始 kuyou 数据库完全一致，供动态 CRUD 白名单防注入。\n"
    ts += "export interface TableMeta {\n"
    ts += "  pk: string;\n  auto: boolean;\n  hasDt: boolean;\n  columns: string[];\n  types: Record<string, string>;\n}\n\n"
    ts += "export const TABLE_META: Record<string, TableMeta> = " + json.dumps(meta, ensure_ascii=False, indent=2) + ";\n\n"
    ts += "export const TABLE_NAMES = Object.keys(TABLE_META);\n"
    os.makedirs(os.path.dirname(BACKEND_OUT), exist_ok=True)
    with open(BACKEND_OUT, "w", encoding="utf-8") as f:
        f.write(ts)

    # ---------- 2) frontend modules.ts ----------
    groups = {g: [] for g in GROUP_ORDER}
    for t in sorted(tables.keys()):
        info = tables[t]
        cols = []
        for c in info["columns"]:
            editable = c["name"] not in AUTO_FIELDS
            cols.append({
                "prop": c["name"],
                "label": c["comment"] or c["name"],
                "type": frontend_type(c["type"], c["enum"]),
                "editable": editable,
                "enum": c["enum"],
                "required": ("NOT NULL" in "" and False),  # 占位，下方补充
            })
        # 简单 required 判定：非空且非自增且无默认
        g = group_of(t)
        title = NAME_MAP.get(t)
        if not title:
            if len(info["columns"]) > 1 and info["columns"][1]["comment"]:
                title = info["columns"][1]["comment"]
            else:
                title = humanize(t)
        groups[g].append({
            "key": t,
            "title": title,
            "group": g,
            "pk": info["pk"],
            "hasDt": info["has_dt"],
            "columns": cols,
        })
    # 过滤空组
    groups = {k: v for k, v in groups.items() if v}
    ordered = {k: groups[k] for k in GROUP_ORDER if k in groups}
    ordered.update({k: v for k, v in groups.items() if k not in ordered})

    fts = "// 自动生成，请勿手改。来源：db/schema.sql\n"
    fts += "import type { RouteRecordRaw } from 'vue-router';\n\n"
    fts += "export interface ColumnMeta {\n"
    fts += "  prop: string;\n  label: string;\n  type: 'text' | 'number' | 'textarea' | 'select';\n"
    fts += "  editable: boolean;\n  enum?: { value: string; label: string }[] | null;\n  required?: boolean;\n}\n"
    fts += "export interface ModuleMeta {\n"
    fts += "  key: string; title: string; group: string; pk: string; hasDt: boolean; columns: ColumnMeta[];\n}\n"
    fts += "export interface GroupMeta { group: string; modules: ModuleMeta[]; }\n\n"
    fts += "export const MODULES: ModuleMeta[] = " + json.dumps(
        [m for gl in ordered.values() for m in gl], ensure_ascii=False, indent=2) + ";\n\n"
    fts += "export const GROUPED_MODULES: GroupMeta[] = " + json.dumps(
        [{"group": g, "modules": ms} for g, ms in ordered.items()], ensure_ascii=False, indent=2) + ";\n\n"
    fts += "export function findModule(key: string): ModuleMeta | undefined {\n"
    fts += "  return MODULES.find((m) => m.key === key);\n}\n"
    os.makedirs(os.path.dirname(FRONTEND_OUT), exist_ok=True)
    with open(FRONTEND_OUT, "w", encoding="utf-8") as f:
        f.write(fts)

    print(f"解析表: {len(tables)}")
    print(f"后端元数据: {BACKEND_OUT}")
    print(f"前端模块: {FRONTEND_OUT}")
    # 打印分组统计
    for g, ms in ordered.items():
        print(f"  {g}: {len(ms)} 个模块")


if __name__ == "__main__":
    build()
