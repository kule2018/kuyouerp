# 03 · 系统架构

本章说明 kuyou-nestjs-vue 的整体分层、路由约定与「四大引擎」设计理念。理解本章有助于你高效地进行二次开发。

---

## 1. 分层总览

```
┌─────────────────────────────────────────────┐
│                前端 (Vue 3 + Vite)            │
│  views/*  ── 通用页 (crud/document/report…)    │
│  components/ds + Base*  ── DeepSeek UI 设计系统 │
│  api/*  ── 接口封装 (axios)                     │
└───────────────┬─────────────────────────────┘
                │  HTTP / JSON   (前缀 /kuyou)
┌───────────────▼─────────────────────────────┐
│              后端 (NestJS)                     │
│  main.ts  ── 全局前缀 / CORS / 异常过滤器       │
│  common/  ── 守卫 / 过滤器 / 统一响应 / 基础服务 │
│  modules/ ── auth / rbac / ai / erp            │
│     ├─ erp/dynamic-crud  引擎① 动态 CRUD        │
│     ├─ erp/document      引擎② 单据              │
│     ├─ erp/report        引擎③ 报表              │
│     ├─ erp/special       引擎④ 专项计算          │
│     └─ erp/*             业务模块                │
│  entities/  ── TypeORM 实体（约 156 张表）       │
│  table-meta.ts / table-comments.ts ── 元数据     │
└───────────────┬─────────────────────────────┘
                │  TypeORM (mysql2)
┌───────────────▼─────────────────────────────┐
│              MySQL 8 (kuyou_*)                │
└─────────────────────────────────────────────┘
```

---

## 2. 路由约定

后端统一设置全局前缀 `kuyou`，即所有接口形如：

```
/kuyou/<模块>/<方法>
```

其中「模块」通常为真实表名（如 `kuyou_goods`），「方法」为业务动作（如 `index`、`add`、`audit`）。前端通过 `Vite` 代理把 `/kuyou` 转发到后端 `3000` 端口，从而规避跨域。

前端路由（`frontend/src/router/index.ts`）同样采用「通用页 + 参数」的方式，而非为每个表写独立页面：

| 路由 | 承载页面 | 驱动配置 |
| --- | --- | --- |
| `/crud/:table` | 通用 CRUD 页 | `config/modules.ts` |
| `/doc/:table` | 通用单据页 | `config/documents.ts` |
| `/report/:key` | 通用报表页 | `config/reports.ts` |
| `/special/:type` | 专项计算页 | `views/special.vue` 内置 6 类 |
| `/ai` | AI 控制台 | `views/ai.vue` |

---

## 3. 四大引擎（核心设计）

项目的页面形态可归纳为四类，因此用四个通用引擎覆盖，而非逐个手写上百个控制器。

### 引擎①：动态 CRUD（基础资料 / 业务台账）

- **后端**：`modules/erp/dynamic-crud` 的 `DynamicCrudController`（`@Controller('kuyou')`）以 `:table/:action` 动态路由，对任意 `kuyou_` 表执行原生 SQL 增删改查。
- **前端**：单一通用页 `views/crud.vue` + 路由 `/crud/:table`，按 `config/modules.ts`（由 `schema.sql` 生成的列元数据）渲染表格、搜索与表单。
- **覆盖**：全部业务表（约 156 张）的 `index / selectpage / detail / add / edit / del`。

### 引擎②：单据引擎（主从表 + 审核过账）

- **后端**：`modules/erp/document` 的 `DocumentModule`。
- **能力**：
  - 主从保存：事务内先写主表拿单号，再按关联键「先删后插」整体替换明细行；
  - 明细关联支持三种模式：同名单号 / 外键关联 / 双仓调拨；
  - 审核 / 反审核：状态位幂等保护（重复审核报错），写入审核人 / 审核时间；
  - 库存联动：审核按方向增减 `kuyou_goods_stock` 与 `kuyou_goods.inventory`，反审核反向冲回，调拨单调出仓减、调入仓加。
- **接口**：`GET /kuyou/:table/doclist`、`GET /kuyou/:table/doc/:id`、`POST /kuyou/:table/save`、`POST /kuyou/:table/audit`、`GET /kuyou/documents`。

### 引擎③：报表引擎（统计查询）

- **后端**：`modules/erp/report` 的 `ReportModule`，用「报表定义」驱动。
- **能力**：每个报表声明数据来源、显示列、可筛字段；SELECT 片段来自固化配置，用户输入只进入参数化 `WHERE`；支持日期区间、字典下拉筛选、GROUP BY 汇总、数值合计与 CSV 导出。
- **接口**：`GET /kuyou/reports`、`GET|POST /kuyou/report/:key`。

### 引擎④：专项业务引擎（计算型页面）

- **后端**：`modules/erp/special` 的 `SpecialModule`，逐一实现重计算逻辑：MRP 计算、智能补货、已销订购看板、计件 / 计时工资、结账 / 反结账、系统初始化。
- **特点**：读多张表 → 计算 → 事务落库。

---

## 4. 模块清单

后端 `app.module.ts` 注册的模块如下：

| 模块 | 职责 |
| --- | --- |
| `AuthModule` | 登录（JWT）、密码校验 |
| `RbacModule` | 角色 / 管理员权限 |
| `AiModule` | AI 能力层（对话 / Agent / 工具 / 检索 / 日志） |
| `DynamicCrudModule` | 引擎① 动态 CRUD |
| `DocumentModule` | 引擎② 单据 |
| `ReportModule` | 引擎③ 报表 |
| `SpecialModule` | 引擎④ 专项计算 |
| `InvoicingModule` | 开票登记 / 台账 |
| `PrintModule` | 打印中心 |
| `StatsModule` | 数据中心看板 |
| `BomModule` | BOM 配方 / 工序主从 |
| `RelationModule` | 外键关联下拉字典 |
| `LinkModule` | 表单联动（单位 / 序列号 / 批次 / 源单 …） |
| `ImportModule` | Excel 导入（专用 + 通用） |
| `RecycleModule` | 回收站 / 单据模板 |
| `MiscModule` | 零散端点（发货 / 地区 / 利润 / 附件 …） |
| `RetailModule` | POS 收银台（零售单 / 零售退货单） |
| `ReconModule` | 对账中心（客户 / 供应商 / 商品收发 / 序列号） |
| `SummaryModule` | 汇总报表 |
| `OrderModule` | 用户订单富化与行内操作 |
| `AppletModule` | 小程序端接口（订货通 / 生产小程序对接） |
| `FinanceModule` | 收付款核销 |
| `StocktakeModule` | 库存盘点建单 / 过账 |
| `DataModule` | 操作日志 / 通用 CSV 导出 |
| `CustomerGoodscodingModule` | 客户物料编码 |

---

## 5. 安全设计要点

- **统一响应**：`common/utils/resp` 的 `ok / table / err`，结构 `{code, msg, data}`；列表返回 `{total, rows}`。
- **统一异常**：全局 `AllExceptionsFilter` 拦截异常，返回一致的错误结构。
- **SQL 安全**：所有动态拼 SQL 必须走 `table-meta.ts` 的 **表 / 列白名单**（`TABLE_META`）+ **值参数化**，杜绝注入。
- **权限**：`AuthModule` 基于 JWT，`common/guards` 提供守卫；前端 `directives/permission` 提供 `v-permission` 指令做按钮级控制。

下一章 [04 · 数据库设计](./04-database.md) 介绍表结构与初始化脚本。
