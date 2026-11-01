# 05 · 接口规范

本章汇总对外 HTTP 接口。所有接口统一前缀 `kuyou`，返回结构统一为 `{code, msg, data}`（列表为 `{total, rows}`）。

---

## 1. 通用约定

### 基础前缀
```
/kuyou/<模块>/<方法>
```

### 统一返回结构
```jsonc
// 单条 / 操作
{ "code": 1, "msg": "ok", "data": { ... } }
// 列表
{ "code": 1, "msg": "ok", "data": { "total": 100, "rows": [ ... ] } }
```
- `code`：业务码，`1` 通常表示成功。
- 异常时由全局 `AllExceptionsFilter` 包裹为一致的错误体。

### 鉴权
登录接口返回 `token`，后续请求在 `Authorization` 头携带（Bearer）。未携带或失效由守卫拦截。

### 安全
所有动态拼 SQL 的端点均走 `table-meta.ts` 的 **表 / 列白名单** + **值参数化**；用户输入只进入参数化 `WHERE`，杜绝注入。

---

## 2. 认证与基础资料（动态 CRUD）

| 能力 | 路由 | 说明 |
| --- | --- | --- |
| 登录 | `POST /kuyou/index/login` | 返回 `{token, user}` |
| 列表 | `GET  /kuyou/:table/index` | 支持 `filter` / `op` / `search` / `sort` / `order` / `offset` / `limit` |
| 下拉分页 | `GET  /kuyou/:table/selectpage` | 返回 `{total, rows, list}` |
| 单条 | `GET  /kuyou/:table/detail/:id` | 返回单条数据 |
| 新增 | `POST /kuyou/:table/add` | body 为字段键值 |
| 编辑 | `POST /kuyou/:table/edit` | body 带主键 |
| 删除 | `POST /kuyou/:table/del` | body `ids` 逗号分隔（软删） |
| 批量操作 | `POST /kuyou/:table/multi` | 批量启用 / 禁用 / 删除 |

`index` 的 `op` 支持：`= != > >= < <= LIKE NOT LIKE IN BETWEEN NULL`。含 `deletetime` 的表自动软删。

---

## 3. 业务单据（引擎②）

| 能力 | 路由 | 说明 |
| --- | --- | --- |
| 单据清单 | `GET  /kuyou/documents` | 返回全部单据类型定义 |
| 单据列表（含业务固定过滤） | `GET  /kuyou/:table/doclist` | 服务端 `fixedFilter` 强制约束 |
| 单据详情（表头 + 明细） | `GET  /kuyou/:table/doc/:id` | 返回 `{header, lines}` |
| 主从保存 | `POST /kuyou/:table/save` | body `{header, lines}` |
| 审核 / 反审核 | `POST /kuyou/:table/audit` | body `{id, state}` |

> **同一张表多个业务页面**：例如零售单与销货单共用物理表，靠 `order_type` 字段区分；服务端下发的 `fixedFilter` 覆盖前端同名列，保证两个页面数据互不串、也无法绕过。

---

## 4. 报表（引擎③）

| 能力 | 路由 | 说明 |
| --- | --- | --- |
| 报表清单 | `GET  /kuyou/reports` | 返回全部报表定义 |
| 执行报表 | `GET|POST /kuyou/report/:key` | 支持 `offset` / `limit` 与筛选参数 |

报表覆盖采购 / 销售 / 库存 / 资金四大类，支持日期区间、字典筛选、分组汇总、合计与 CSV 导出。

---

## 5. 专项计算（引擎④）

| 能力 | 路由 |
| --- | --- |
| 生产计划明细行 | `GET  /kuyou/special/mrp/plan-lines?purchase_code=` |
| MRP 列表 / 明细 | `GET  /kuyou/special/mrp/list`、`GET  /kuyou/special/mrp/detail/:id` |
| 执行 MRP 计算 | `POST /kuyou/special/mrp/compute` |
| 智能补货 | `GET  /kuyou/special/replenishment` |
| 已销订购看板 | `GET  /kuyou/special/sold-ordered` |
| 计件 / 计时工资 | `GET  /kuyou/special/wages?type=piece|hour` |
| 结账状态 | `GET  /kuyou/special/checkout/status` |
| 结账 / 反结账 | `POST /kuyou/special/checkout/do`、`POST /kuyou/special/checkout/undo` |
| 系统初始化 | `POST /kuyou/special/initialization`（`{confirm:'INITIALIZE'}`） |

---

## 6. 收付款核销 / 库存盘点 / 操作日志 / 导出

| 能力 | 路由 | 说明 |
| --- | --- | --- |
| 收款核销 | `POST /kuyou/collection/add` | `{customers_id, accounts_id, money, remark}`——事务内冲减客户应收、登记明细与账户流水、更新余额、写日志 |
| 付款核销 | `POST /kuyou/payment/add` | `{suppliers_id, accounts_id, money, remark}`——同上，冲减供应商应付 |
| 盘点建单 | `POST /kuyou/stocktake/add` | `{stores_id, remark, items:[{goods_id, actual_stock}]}` |
| 盘点过账 | `POST /kuyou/stocktake/post` | `{id}`——按盘盈 / 盘亏校正库存 |
| 盘点列表 / 明细 | `GET  /kuyou/stocktake/index`、`GET  /kuyou/stocktake/detail/:id` | |
| 操作日志 | `GET  /kuyou/operate_log/index` | `?limit=200` |
| 通用导出 | `GET  /kuyou/data/export?table=goods\|customers\|suppliers\|stocktake` | 返回 CSV |

---

## 7. 关联 / 联动 / 导入 / 回收站（节选）

| 类别 | 代表性路由 |
| --- | --- |
| 外键关联下拉 | `GET /kuyou/relation/<...>`（供应商 / 客户 / 商品 / 仓库 / 账户 / 车间 / 单位 / 职员 / 分类等字典） |
| 表单联动 | `GET /kuyou/link/getUnit`、`/link/getSerial`、`/link/getSuppliers`、`/link/planinfo` …（单位价格库存、源单带明细、批次与序列号、BOM 展开等） |
| Excel 导入 | `POST /kuyou/import/<...>`（客户 / 供应商 / 商品 / 职员 / 仓库等专用 + 通用导入）+ `POST /kuyou/ajax/upload` |
| 回收站 | `GET /kuyou/recycle/recyclebin`、`POST /kuyou/recycle/restore`、`POST /kuyou/recycle/destroy` |
| 单据模板 | `POST /kuyou/recycle/savetemp`、`GET /kuyou/recycle/gettemp`（组装 / 拆卸单） |
| 对账中心 | `GET /kuyou/recon/<...>`（客户 / 供应商对账单、商品收发明细、序列号状态） |
| 汇总报表 | `GET /kuyou/summary/<...>`（采购 / 销货汇总、收入支出） |
| 打印中心 | `GET /kuyou/prints/types`、`POST /kuyou/prints/<...>`（单据 / 汇总表打印，含人民币大写与打印次数自增） |

---

## 8. AI 接口（详见 [06 · AI 能力层](./06-ai-layer.md)）

| 能力 | 路由 |
| --- | --- |
| 对话 | `POST /kuyou/ai/chat` |
| Agent 执行 | `POST /kuyou/ai/agent` |
| 知识检索 | `POST /kuyou/ai/retrieve` |
| 工具列表 | `GET  /kuyou/ai/tools` |
| 模型 / Prompt / 知识库 CRUD | `/kuyou/ai/model-config`、`/kuyou/ai/prompt-template`、`/kuyou/ai/knowledge` |
| 调用日志 | `/kuyou/ai/call-log` |

---

## 9. 调用示例

```bash
# 登录获取 token
curl -X POST http://localhost:3000/kuyou/index/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"123456"}'

# 查询商品列表（带分页与排序）
curl 'http://localhost:3000/kuyou/kuyou_goods/index?offset=0&limit=20&sort=id&order=desc' \
  -H 'Authorization: Bearer <token>'
```

> 完整的请求 / 响应样例可结合前端「网络面板」观察，或使用仓库自带 `audit-endpoints.js` 查看接口覆盖情况（见 [08 · 开发指南](./08-development.md)）。
