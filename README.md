# ERP —— NestJS + Vue3



---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | **NestJS** 10 + TypeORM + MySQL + JWT |
| 前端 | **Vue3** + Vite + TypeScript + **DeepSeek UI**（`src/components`，自建设计系统）+ **Vue-Router** + **Axios** |
| AI | OpenAI 兼容 ChatClient（等价 Spring AI ChatClient）+ 模型配置库 + Prompt 模板 + `@Tool` 工具调用 + Agent 多轮 + 关键词检索 + 结构化 JSON + 调用日志 |
| 数据库 | MySQL 8（schema 由原始 `install.sql` 全量迁移，表名保留 `kuyou_` 前缀） |

---

## 功能特性

> 以下能力均已实现并可直接运行，业务覆盖。

- **基础资料（通用 CRUD 全覆盖）**：商品 / 仓库 / 客户 / 供应商 / 职员 / 账户 / 单位 / 商品分类 / 收支类别 / 结算方式 / 辅助属性 / 车间 / 委外工厂 / 司机 / 自取地址 / 轮播 / 系统配置 / 用户等，全部 156 张 `kuyou_` 表由动态 CRUD 引擎统一提供增删改查与表单。
- **业务单据（30 类）**：购货 / 销货及其订单与退货、零售 / 零售退货、调拨、盘点、序列号盘点、其他出入库、组装拆卸、成本调整、收款付款、资金转账、核销、其他收支、订货单、生产计划 / 生产单 / 领料 / 委外 / 验收；主从保存 + 审核过账 + 库存联动。
- **报表中心（27 张）**：采购 / 销售 / 库存 / 资金四大类，支持日期区间、字典筛选、分组汇总与 CSV 导出。
- **计算型专项（6 个）**：MRP 计算、智能补货、已销订购看板、计件 / 计时工资、结账 / 反结账、系统初始化。
- **打印中心**：采购 / 销售 / 退换货 / 调拨 / 盘点 / 组装拆卸 / 收付款 / 核销 / 其他收支 **17 类单据** + 采购明细 / 订单跟踪 / 采购汇总 / 付款流水 / 销售跟踪 **6 类汇总表**，含人民币大写与打印次数自增。
- **开票登记**：采购 / 销货开票登记 + 台账冲销。
- **往来欠款对账**：客户应收 / 供应商应付对账表。
- **数据中心看板**：近 7 日购货 / 销货趋势、按仓库库存统计、账户资金统计、本月购销汇总。
- **BOM 配方 / 工序**：清单 + 工序主从编辑，明细行增删后自动回算清单数量 / 金额合计。
- **收付款核销（本轮新增）**：独立收 / 付款单流，事务冲减客户应收 / 供应商应付、登记往来明细与账户流水、更新结算账户余额并写操作日志。
- **库存盘点过账（本轮新增）**：盘点单建单带入系统库存，盘盈 / 盘亏审核过账并校正库存。
- **操作日志与数据导出（本轮新增）**：操作日志查看 + 通用 CSV 导出。
- **AI 能力层**：OpenAI 兼容对话 / Agent 多轮 / 工具调用 / 知识库检索 / 模型与 Prompt 管理 / 调用日志。

---

## 核心设计：四个引擎覆盖原系统全部页面

原系统 289 个页面按形态可归为四类，本项目用四个通用引擎一一对应，而非逐个手写 200+ 控制器：

### 1. 动态 CRUD（基础资料 / 业务台账）
覆盖全部 **156 张表**：后端 `DynamicCrudController`（`@Controller('kuyou')`）用 `:table/:action` 动态路由对任意 `kuyou_` 表执行原生 SQL 增删改查；前端单一通用页 `views/crud.vue` + 路由 `/crud/:table`，按 `config/modules.ts`（由 `schema.sql` 生成的列元数据）渲染表格、搜索与表单。

### 2. 单据引擎（主从表 + 审核过账）
原系统业务单据（购货单/销货单/调拨单/生产单…）是「表头 + 明细行 + 审核」结构， CRUD 覆盖不了。`DocumentModule` 用一张配置表 + 一套事务逻辑覆盖 **28 类单据**：

| 能力 | 实现 |
|---|---|
| 主从保存 | 事务内先写主表拿到单号，再按关联键「先删后插」整体替换明细行，避免孤儿行 |
| 明细关联 | 支持三种原系统模式：① 同名单号 `purchase_code` ② 外键 `<xxx>_id → id`（调拨/生产类）③ 双仓调拨 |
| 审核 / 反审核 | 状态位幂等保护（重复审核报错），写入审核人 / 审核时间 |
| 库存联动 | 审核时按 `direction`（in/out）增减 `kuyou_goods_stock` 与 `kuyou_goods.inventory`；反审核反向冲回；调拨单调出仓减、调入仓加 |

接口：`GET /kuyou/:table/doclist`（含业务固定过滤）、`GET /kuyou/:table/doc/:id`、`POST /kuyou/:table/save`、`POST /kuyou/:table/audit`、`GET /kuyou/documents`

> **同一张表多个业务页面**：零售单与销货单共用 `kuyou_goods_sales`，靠 `order_type=2` 区分。
> 单据配置新增 `fixedFilter`（服务端下发，覆盖前端同名列），列表走 `doclist`、写入时也强制落库，
> 两个页面数据互不串、也无法绕过。

### 3. 报表引擎（27 张报表页）
原系统 30 多张报表页只做查询聚合。`ReportModule` 用「报表定义」驱动 **27 张报表**（采购/销售/库存/资金四大类）：每个报表声明数据来源、显示列、可筛字段；**SELECT 片段来自固化配置，用户输入只进入参数化 WHERE**，支持日期区间、字典下拉筛选、GROUP BY 汇总、数值合计与 CSV 导出。

> 统一约定：所有动态拼 SQL 的地方，表名/列名走 `TABLE_META` 白名单，取值全部参数化，杜绝注入。
> 列表返回 `{ total, rows }`，`rows` 用数据库原始列名（snake_case），与原系统表格输出约定一致。

### 4. 专项业务引擎（6 类计算型页面）

这几个页面既不是列表也不是单据，而是「读多张表 → 计算 → 落库」的重逻辑，`SpecialModule` 逐一按原控制器复刻：

| 页面 | 原模块 | 计算口径 |
|---|---|---|
| **MRP 计算** | `Mrps` | 生产计划明细 → BOM 逐级展开子件 → 子件用量 × 计划产量 = 毛需求 → 扣现有库存 → 单位换算率折算 → 得**建议采购量**，事务写入 `kuyou_mrp` + `kuyou_mrp_info` |
| **智能补货** | `Replenishment` | 建议采购量 = 区间销售需求量 + 最低安全库存 − 现有库存 − 在途采购量（<0 取 0） |
| **已销订购看板** | `Purchaseby` | 销售订单明细回填：已销数量 / 已出库数量 / 关联采购单号及其审核状态 |
| **计件 / 计时工资** | `Wages`、`Wageshour` | 计件 = Σ(验收数量 × BOM 工序单价)；计时 = Σ(工时 × BOM 工序工时单价) |
| **结账 / 反结账** | `Checkout` | 期末对全部商品做成本快照（先进先出 / 移动平均双口径），回填本期 `kuyou_goods_sales_profit.sales_cost`；反结账事务回滚最后一次 |
| **系统初始化** | `Initialization` | 事务内清空 140 张业务表并把 `kuyou_sets` 恢复为出厂默认值（需 `confirm=INITIALIZE`） |

**POS 收银台（零售单 / 零售退货单）**：原系统 `retail/GoodsSales` + `retail.html` 是一套完整 PC 收银台（商品网格、多单位多属性、购物车、挂单、结账过账、小票打印、F7–F10 快捷键），与销货单共用 `kuyou_goods_sales` 物理表、靠 `order_type=2` 区分。已新建独立 `RetailModule`（`retail.service.ts` / `retail.controller.ts`）+ 前端 `views/pos.vue` ：
- `POST /kuyou/retail/posinit`：公司名 / 结算账户 / 小数位等收银台初始化配置
- `POST /kuyou/retail/getGoodsList`：商品网格（客户等级价、多单位、辅助属性、分页、关键字/分类筛选）
- `POST /kuyou/retail/goods_sales/add`（types=ls）：结算过账——双单号、库存分配、批次/序列号消耗、事务写 `kuyou_goods_sales`+`info`、按系统开关自动审核；非 ls 走原单据新增
- `POST /kuyou/retail/goods_sales/examine`：零售单审核 / 反审核
- `POST /kuyou/retail/goods_sales/edit`、`/del`：零售单编辑 / 删除（复用单据引擎）

接口：`/kuyou/special/mrp/{plan-lines,list,detail,compute}`、`/kuyou/special/replenishment`、`/kuyou/special/sold-ordered`、`/kuyou/special/wages`、`/kuyou/special/checkout/{status,do,undo}`、`/kuyou/special/initialization`

---

## 目录结构

```
kuyou-nestjs-vue/
├── backend/                       # NestJS 后端
│   ├── scripts/
│   │   ├── gen-entities.py        # install.sql → 156 个 TypeORM 实体
│   │   └── gen-table-meta.py      # schema.sql → 表元数据（后端白名单 + 前端菜单）
│   ├── src/
│   │   ├── table-meta.ts          # [生成] 表→列名/类型/pk/deletetime 白名单
│   │   ├── config/                # 数据库配置
│   │   ├── common/                # 守卫/异常/响应/BaseCrudService
│   │   └── modules/
│   │       ├── auth/              # 登录(JWT)，密码方案复刻原系统(md5+salt)
│   │       ├── ai/                # AI 能力层（见下）
│   │       └── erp/
│   │           ├── dynamic-crud/    # 动态 CRUD：覆盖全部 156 表
│   │           ├── document/        # 单据引擎：28 类主从单据 + 审核过账 + 库存联动
│   │           ├── report/          # 报表引擎：27 张报表定义 + 查询
│   │           ├── special/         # 专项业务：MRP/补货/看板/工资/结账/初始化
│   │           ├── link/            # 表单联动：单位/序列号/批次/效期/源单/计划/核销/商品弹窗
│   │           ├── import/          # Excel 导入：9 类专用 + 通用（按列注释）+ ajax/upload
│   │           ├── recycle/         # 回收站 recyclebin/restore/destroy + 单据模板 savetemp/gettemp
│   │           ├── misc/            # 零散端点：发货/地区/利润/费用预检/附件 + 源命名别名
│   │           ├── recon/           # 对账中心：客户/供应商对账单、商品收发明细、序列号状态
│   │           ├── summary/         # 汇总报表：采购/销货汇总、收入支出
│   │           ├── finance/         # 收付款核销：collection/add、payment/add（冲减往来余额+登记明细+账户流水）
│   │           ├── stocktake/       # 库存盘点：stocktake/add（建单）、stocktake/post（盘盈盘亏过账）
│   │           ├── data/            # 操作日志 operate_log/index + 通用 CSV 导出 data/export
│   │           └── retail/          # POS 收银台：posinit/getGoodsList/结算过账/审核（零售单 order_type=2）
│   ├── entities/                    # 156 张表自动生成的实体
│   └── test-*.js                    # 隔离单测（不连库，共 578 条断言）
├── frontend/
│   └── src/
│       ├── config/
│       │   ├── modules.ts           # [生成] 全量菜单 + 列/表单元数据
│       │   ├── documents.ts         # 28 类单据前端配置（含引用数据源映射）
│       │   └── reports.ts           # [生成] 27 张报表菜单
│       ├── api/                     # dynamic / document / report 接口封装
│       ├── components/              # DeepSeek UI 设计系统（全局注册，见下）
│       │   ├── ds/                  # 原子层：DsButton/Input/Select/Table/Menu/Modal…（含 theme.css + toast）
│       │   └── Base*.vue            # 业务层：BaseForm/BaseGrid/BaseDrawer/StatCard…
│       ├── scripts/
│       │   └── check-ds-bindings.cjs # UI 绑定自检（见「UI 迁移自检」）
│       └── views/                   # 登录/布局/仪表盘/CRUD/单据页/报表页/POS/AI 控制台
├── db/
│   ├── schema.sql                 # 全量建表+初始数据（install.sql 适配）
│   ├── seed.sql                   # admin 表 + 演示账号
│   ├── ai-tables.sql              # AI 能力层 6 张表
│   └── finance-stocktake-tables.sql  # 收付款核销/盘点/操作日志 3 张扩展表（schema 之后执行）
├── 订货通小程序/                   # [开源] uniapp vue3 客户订货商城（对接 /kuyou 后端）
└── 生产小程序/                     # [开源] uniapp Vue3 MES 生产现场（对接 /kuyou/applet 后端）
```

---

## 移动端小程序（开源）

仓库同时附带两套**开源 uniapp 小程序**，均对接本项目的 NestJS 后端（同一 `/kuyou` 接口前缀与 JWT 登录态），与 PC 管理后台共用同一数据库。可一键编译到微信小程序 / H5 / App。

### 1. 订货通小程序（`订货通小程序/`）

面向**客户 / 经销商**的移动订货商城，uniapp（Vue 2）+ uView UI（`components/uview-ui`）。

| 项 | 内容 |
| --- | --- |
| 技术 | uniapp Vue 2 + uView UI |
| 入口（`pages.json`） | `pages/login`（登录）、`pages/home`（商城首页 / 商品分类页 `homeGoods`）、`pages/category`（分类）、`pages/shopping`（订货单 / 提交订单 / 收货地址）、`pages/my`（我的 / 订单 / 物流 / 账户 / 地址 / 协议）、`pages/ai`（AI 智能助手）|
| 后端地址 | `config/index.js` 的 `httpURL`（默认 `https://your-domain.com`，微信小程序需在小程序后台配置 request 合法域名；本地 H5 调试可留空走 `/kuyou` 代理）|
| 接口 | 复用后端 `/kuyou/order/*`、`/kuyou/goods/*` 等（与动态 CRUD / 单据引擎同一后端）|

启动：用 HBuilderX 打开 `订货通小程序/` 目录运行，或 CLI `npm install && npm run dev:mp-weixin`。

### 2. 生产小程序 / MES（`生产小程序/`）

面向**车间 / 生产现场**的移动 MES，uniapp（Vue 3），含数据大屏与扫码。

| 项 | 内容 |
| --- | --- |
| 技术 | uniapp Vue 3（自定义 tabBar `custom-tab-bar/`）|
| 入口（`pages.json`） | `pages/home`（MES 生产管理）、`pages/data`（数据大屏）、`pages/mine`（设置 / 关于 / 协议）、`pages/ai`（AI 智能助手）|
| 业务页 | BOM 清单 / 生产工序、生产计划、MRP 计算、生产成本、计件 / 计时工资、验收单、退料单、委外加工单、领料单、生产单、扫描商品（`pages/common/scan`）|
| 后端地址 | `static/config/index.js` 的 `BASE_URL`（默认 `DOMAIN + '/kuyou/applet/'`，填 `DOMAIN` 即可）|
| 接口封装 | `request/http.js`（自动带 `Authorization: Bearer <token>`，401 跳登录）+ `request/apis/`（31 个业务 API 模块）|

启动：`npm install && npm run dev:mp-weixin`。

> **接口路径说明**：订货通走 `/kuyou/order/*`、生产 MES 走 `/kuyou/applet/*`；两者与 PC 后台共用 JWT，登录态一致。后端需在对应路由（动态 CRUD / 单据 / 专项引擎）暴露这些端点，PC 管理后台的业务口径不受影响。

---

## UI 体系：DeepSeek 设计系统（Element-Plus 已全量替换）

前端 UI 全部由自建组件库 `src/components`（**DeepSeek 风格设计系统**）承载，**Element-Plus 及其图标包已从源码与 `package.json` 中彻底移除**，产物中零残留。

### 分层

| 层 | 位置 | 说明 |
| --- | --- | --- |
| 原子层 | `src/components/ds/` | `DsButton / DsInput / DsSelect / DsTable / DsMenu / DsModal / DsDrawer / DsTabs / DsPagination / DsDatePicker / DsTag / DsTree / DsTreeSelect / DsUploader / DsMarkdown / DsDescriptions / DsPopover / DsToast / DsConfirm …`，配 `theme.css`（`--ds-*` 设计令牌，明/暗双主题） |
| 业务层 | `src/components/Base*.vue` | `BaseForm / BaseGrid / BaseDrawer / BaseDialog / BaseSelect / BaseUpload / StatCard / Panel …` |
| 安装 | `main.ts` → `installDsUi(app)` | 一次性全局注册全部组件并加载主题，页面无需逐个 import |

### 为承接 kuyou 业务而增强的能力

原 Element 组件的部分能力 Ds 库起初不具备，为确保**功能不降级**做了如下扩展：

| 组件 | 新增能力 |
| --- | --- |
| `DsTable` | 行多选（含全选）、**跨页保留勾选** `reserve-selection`、固定列（left/right 吸附）、服务端排序 `sortable`、`rowspan` 合并 `span-method`、函数式 `row-key`、行类名 `row-class`（小计/合计行高亮）、页脚合计 `show-summary`、受控/非受控选中态 |
| `DsMenu` | 递归嵌套子菜单（原 `el-sub-menu` 三级菜单：模块 → 分组 → 菜单项），含自动展开选中路径、折叠态 Tooltip；叶子节点渲染为真实 `<a href>`，支持中键/ Ctrl+Click 新标签页打开，普通点击走 SPA 路由 |
| `DsSelect` | `remote` + `@search` 远程搜索（商品/客户等异步检索） |
| `DsInput` | 原生 `min / max / step` 透传（金额精度 0.01、单价 0.0001 等） |
| `useConfirm` + `DsConfirm` | 替代 `ElMessageBox.confirm`（Promise 风格，全局挂载） |
| `useToast` + `DsToast` | 替代 `ElMessage / ElNotification`（含 `success/error/warning/info`） |

`ElLoading`、`el-container/aside/header/main`、`el-row/col` 等**布局原语**改为原生 `div` + `theme.css` 令牌实现。

### UI 迁移自检

Element 属性名迁移遗漏时 Vue **不会报错**，而是静默透传到根元素，导致功能悄悄失效（典型的如 `reserve-selection`、`step`）。为此提供自检脚本：

```bash
npm run check:ds     # 或 node scripts/check-ds-bindings.cjs
```

它会扫描 `views/` 与 `components/` 模板中对 Ds 组件的**全部绑定**（动态 `:prop` / `@event` / 静态属性），与组件自身的 `defineProps` / `defineEmits` 逐一比对，输出失效清单；无问题时打印「无失效绑定 ✓」并以 0 退出，适合接入 CI。

### 运行时冒烟（`npm run smoke:ui`）

`vue-tsc` 只能保证静态类型，组件未注册、模板取值错误、生命周期异常等**运行时问题它抓不到**。为此提供真浏览器巡检脚本：

```bash
npm run build                       # 先产出 dist
npm run preview                     # 另开终端：http://localhost:4173
npm run smoke:ui                    # 或 node scripts/smoke-ui.cjs http://localhost:4173
```

脚本行为：
1. 驱动本机 Edge（`EDGE_PATH` 可覆盖），注入假 token 绕过登录守卫；
2. **拦截所有 `/kuyou/**` 请求**返回通用空数据信封，因此**不依赖本机 MySQL 与后端进程**；
3. 用 esbuild 即时转译 `src/config/{modules,documents,reports}.ts` 取真源，拼出全量路由后逐页访问并按页收集 `console.error` 与未捕获异常。

当前基线：**230 条路由全部通过，0 异常页面**。

> 注意：返回**裸数组**（非 `{code,data}` 信封）的端点需在脚本 `ARRAY_ENDPOINTS` 中登记（目前仅 `/prints/types`），否则会误判为运行时错误。

### 没装 MySQL 也能看 UI（mock 后端）

`preview` 已配置 `/kuyou` 代理；把代理目标指向自带的 mock 服务，前端就能在**完全不装 MySQL、不启后端**的情况下跑起来看真实渲染（表格还会按 156 张表的字段类型生成形状正确的假数据）：

```bash
npm run build
npm run mock                                       # 起 mock 后端：http://127.0.0.1:3100
BACKEND_ORIGIN=http://127.0.0.1:3100 npm run preview  # preview 把 /kuyou 指到 mock
# 浏览器打开 http://localhost:4173 ，演示账号 admin / 123456
```

`scripts/mock-server.cjs` 启动时用 esbuild 读 `src/config/modules.ts`，按列类型（number / select 枚举 / date / text）造值，所以列表每一列都填得满、一眼能看出排版问题；`PORT` / `ROWS` 环境变量可改端口与每接口行数。

---

## 快速开始

### 1. 初始化数据库
```bash
mysql -uroot -p < db/schema.sql            # 156 张 kuyou_ 表 + 初始数据
mysql -uroot -p kuyou < db/seed.sql        # admin 表 + admin/123456
mysql -uroot -p kuyou < db/ai-tables.sql   # AI 能力层 6 张表
mysql -uroot -p kuyou < db/finance-stocktake-tables.sql  # 收付款核销/盘点/操作日志 3 张表
```

### 2. 后端
```bash
cd backend
cp .env.example .env      # 按需修改 DB / JWT / AI 配置
npm install
npm run start:dev         # 监听 3000，接口前缀 /kuyou
```

### 3. 前端
```bash
cd frontend
npm install
npm run dev               # 5173，已配置 /kuyou 代理到 3000
npm run check:ds          # 可选：UI 绑定自检
```
浏览器打开 http://localhost:5173 ，用 `admin / 123456` 登录。左侧菜单即全部业务模块，顶栏可切换明/暗主题。

---

## 接口契约（与 kuyou 对齐）

全局前缀 `kuyou`，路由约定 `kuyou/模块/方法`，`模块` 为真实表名（如 `kuyou_goods`）：

| 能力 | 路由 | 返回 |
| --- | --- | --- |
| 登录 | `POST /kuyou/index/login` | `{code:1,msg,data:{token,user}}` |
| 列表 | `GET  /kuyou/:table/index` | `{total, rows}` |
| 下拉 | `GET  /kuyou/:table/selectpage` | `{total, rows, list}` |
| 单条 | `GET  /kuyou/:table/detail/:id` | `{code:1,msg,data}` |
| 新增 | `POST /kuyou/:table/add` | `{code:1,msg,data}` |
| 编辑 | `POST /kuyou/:table/edit`（body 带主键）| `{code:1,msg,data}` |
| 删除 | `POST /kuyou/:table/del`（body `ids` 逗号分隔）| `{code:1,msg,data}` |

`index` 支持原系统的 `filter`/`op`（= != > >= < <= LIKE NOT LIKE IN BETWEEN NULL）、`search` 快速搜索、`sort`/`order`、`offset`/`limit` 分页；含 `deletetime` 的表自动软删。由 `DynamicCrudService` 统一实现，SQL 已做表/列白名单 + 值参数化（见 `backend/test-dynamic-crud.js` 15 项断言）。

---

## AI 能力层（需求映射）

原需求为 Spring AI 术语；NestJS 无法运行 Java，以下为等价落地：

| 需求 | 本实现 |
| --- | --- |
| Spring AI ChatClient | `ChatClientService`（OpenAI 兼容，支持 system prompt / tools / 结构化 JSON）|
| 模型配置数据库化 | `AiModelConfig` 实体 + `ModelConfigService.toClientConfig` 动态加载 |
| Prompt 模板管理 | `AiPromptTemplate` + 变量渲染 `{{var}}` |
| Function Calling（`@Tool` + ToolCallbacks）| `tool.decorator.ts` + `ToolCallbacks`（自动收集并生成 function 定义、按名执行）|
| Agent 多轮自主执行 | `AgentService`（ReAct 式循环：调用→执行工具→回灌→再决策）|
| 关键词检索 | `KeywordRetrievalService`（知识库命中评分召回）|
| 结构化 JSON 输出 | ChatClient `response_format = json_object / json_schema` |
| AI 调用与工具调用日志 | `AiCallLog` / `AiToolCallLog` 全量记录 |

AI 接口：`/kuyou/ai/chat`、`/kuyou/ai/agent`、`/kuyou/ai/retrieve`、`/kuyou/ai/tools`、模型配置/Prompt/知识库 CRUD、调用日志查询。示例工具：`query_goods`、`query_customers`、`calculator`。
前端 `views/ai.vue`（侧边栏「AI 助手」）提供对话、Agent 执行、检索、模型/Prompt/知识库管理与调用日志查看六个页签。

### 单据 / 报表 / 专项业务接口补充

| 能力 | 接口 |
| --- | --- |
| 单据清单 | `GET /kuyou/documents` |
| 单据列表（含业务固定过滤） | `GET /kuyou/:table/doclist` |
| 单据详情（表头+明细） | `GET /kuyou/:table/doc/:id` |
| 主从保存 | `POST /kuyou/:table/save`（`{header, lines}`） |
| 审核 / 反审核 | `POST /kuyou/:table/audit`（`{id, state}`） |
| 报表清单 | `GET /kuyou/reports` |
| 执行报表 | `GET|POST /kuyou/report/:key`（支持 `offset`/`limit`） |
| 生产计划明细行 | `GET /kuyou/special/mrp/plan-lines?purchase_code=` |
| MRP 列表 / 明细 | `GET /kuyou/special/mrp/list`、`GET /kuyou/special/mrp/detail/:id` |
| 执行 MRP 计算 | `POST /kuyou/special/mrp/compute` |
| 智能补货 | `GET /kuyou/special/replenishment` |
| 已销订购看板 | `GET /kuyou/special/sold-ordered` |
| 计件 / 计时工资 | `GET /kuyou/special/wages?type=piece|hour` |
| 结账状态 | `GET /kuyou/special/checkout/status` |
| 结账 / 反结账 | `POST /kuyou/special/checkout/do`、`POST /kuyou/special/checkout/undo` |
| 系统初始化 | `POST /kuyou/special/initialization`（`{confirm:'INITIALIZE'}`） |

### 收付款核销 / 库存盘点 / 操作日志 / 导出（本轮新增）

| 能力 | 接口 |
| --- | --- |
| 收款核销 | `POST /kuyou/collection/add`（`{customers_id, accounts_id, money, remark}`）—— 在事务里开 `kuyou_collection`、冲减客户 `need_receive_account`、登记应收明细 `kuyou_accounts_receivable` + 账户流水 `kuyou_accounts_log`、更新结算账户余额，并写操作日志 |
| 付款核销 | `POST /kuyou/payment/add`（`{suppliers_id, accounts_id, money, remark}`）—— 同上，冲减供应商 `need_give_account`、登记应付明细 `kuyou_accounts_copewith` |
| 盘点建单 | `POST /kuyou/stocktake/add`（`{stores_id, remark, items:[{goods_id, actual_stock}]}`）—— 带入系统库存建 `kuyou_stocktake` 单 |
| 盘点过账 | `POST /kuyou/stocktake/post`（`{id}`）—— 按盘盈（business_type=8）/ 盘亏（business_type=10）写 `kuyou_goods_log` 并校正 `kuyou_goods.inventory` |
| 盘点列表 / 明细 | `GET /kuyou/stocktake/index`、`GET /kuyou/stocktake/detail/:id` |
| 操作日志 | `GET /kuyou/operate_log/index`（`?limit=200`） |
| 通用导出 | `GET /kuyou/data/export?table=goods\|customers\|suppliers\|stocktake`（返回 CSV） |

> 说明：原 `/doc` 收款单/付款单仅建单、审核时不冲减往来余额；实际核销请使用「资金 → 收付款核销」页（调用上述 `collection/add`、`payment/add`）。

---

## 进度（透明说明）

已交付（可直接运行）：
- ✅ **数据库**：156 张 `kuyou_` 表实体 + 原始数据迁移；`admin` 登录表 + AI 六表补齐
- ✅ **后端**：NestJS + TypeORM + JWT + 全局异常 + 动态 CRUD 覆盖**全部 156 表**的 index/selectpage/detail/add/edit/del
- ✅ **单据引擎**：28 类主从单据（采购/销售/仓储/资金/生产/盘点/订货），含主从事务保存、审核/反审核幂等、库存增减与双仓调拨联动
- ✅ **报表引擎**：27 张报表（采购 5 / 销售 8 / 库存 7 / 资金 7），含日期区间与字典筛选、分组汇总、数值合计、CSV 导出
- ✅ **AI 模块**：8 项能力完整实现 + AI 控制台页面
- ✅ **专项业务**：MRP 计算 / 智能补货 / 已销订购看板 / 计件计时工资 / 结账反结账 / 系统初始化 六类计算型页面
- ✅ **零售单 / 零售退货单**：复用 `kuyou_goods_sales`（`order_type=2`），列表与写入均受服务端固定过滤约束
- ✅ **前端**：登录 / 布局 / 仪表盘 / 通用 CRUD / 主从单据页 / 报表页 / 专项业务页 / AI 控制台；侧边栏按原系统业务分组列出全部模块、单据、报表与专项业务
- ✅ **BOM 配方 / 工序**：`Bom` + `Procedure` 嵌套主从——清单主表 `kuyou_bom` + 直接物料、工序主表 `kuyou_bom_procedure` + 工序物料（共用 `kuyou_bom_info`，靠 `procedure_id` 区分），保存/删除后按 `bom_id` 回算清单合计，删除清单级联清理工序与物料
- ✅ **外键关联下拉**：`RelationModule` + `config/relations.ts` 为基础资料表单的供应商/客户/商品/仓库/账户/车间/单位/职员/分类等级等外键列提供字典下拉（表/列白名单防注入），编辑回显按值原类型匹配
- ✅ **审核财务联动 + 对单**：`document.finance.ts` 为十类单据挂财务档案——审核时同步往来欠款、账户余额、账户流水（business_type 1~12）、收付款流水、开票登记与核销推进；`checkOutTime` 结账期间校验拦截结账日之前的单据；`counter` 对单只翻 `check_status` 不过账
- ✅ **表单联动端点**：`LinkModule` 复刻原系统 getUnit/getSerial/getSuppliers/getBranch/getTime/formatInfo/checkPurchase/pickinfo/planinfo/choselist 等 40+ 联动接口——选商品带出单位价格库存、选源单带出明细、效期互算、批次与序列号、计划 BOM 展开、盘点盈亏方向、辅助属性笛卡尔组合
- ✅ **Excel 导入**：`ImportModule` 覆盖 9 类专用导入（客户/供应商/商品/职员/仓库/客户物料编码/工厂/车间/盘点单）+ 通用导入（按 `schema.sql` 列注释映射表头，覆盖原系统每张表的导入按钮）；含 `ajax/upload` 上传端点、`editstatus` 更新策略、编号重复与字典缺失校验、期初核销源与收付款流水写入
- ✅ **回收站与单据模板**：`RecycleModule` 提供 recyclebin/restore/destroy（13 张软删表白名单，供应商彻底删除级联清理联系人），以及组装单/拆卸单的 savetemp/gettemp
- ✅ **核销源单选择 / 商品选择弹窗 / 订单转退换货**：writeoff 四类 chose 接口、chosegoods 商品弹窗（辅助属性展开）、period 序列号串处理、checkExchange 订单检查，另有发货、地区树、销售利润、费用预检、附件上传等零散端点（`MiscModule`）
- ✅ **通用批量操作**：`:table/multi` 复刻原系统批量启用/禁用/删除，支持 `params` 字符串与对象两种形态
- ✅ **表级扩展按钮与列表富化**：`config/table-extras.ts` 按表声明专属能力——库存盘点「导出盘点」（xlsx 文件流下载）、用户订单行内「审核 / 发货（含配送司机选择）/ 生成销货单」并跳转销货单预取填充；用户订单列表按源 `UserOrder::index` 联表富化（sales_id / 司机姓名 / 到店自取地址后缀 / 商品行展开），前端按订单号合并单元格（tableMerge 等效）+ 状态下拉与下单时间区间筛选
- ✅ **编译与测试**：`nest build` 零错误；`npm run build`（前端 `vue-tsc --noEmit && vite build`）零错误并产出可运行生产包；隔离单测 **581 条断言全通过**（动态 CRUD 22 + 单据 36 + 报表 23 + 专项 37 + 开票 20 + 打印 25 + 统计 12 + BOM 27 + 关联字典 8 + 财务联动 51 + 表单联动 64 + 导入 51 + 回收站/模板 40 + 零散业务 63 + 对账 33 + 汇总 29 + 零售收银台 40）。
- ✅ **UI 迁移（Element-Plus → DeepSeek UI）**：全站 `<el-*>` 归零、`element-plus` 与 `@element-plus/icons-vue` 依赖移除、`dist` 产物零残留；`npm run check:ds` 报告「无失效绑定 ✓」。
  > 注：`src/components/*` 现已成为本项目 UI 设计系统，不再是游离组件；已补齐 `xlsx` 依赖并修正类型，与主体一并 `vue-tsc` 零错误。

- ✅ **收付款核销（独立单据流）**：`FinanceModule` 在事务内开 `kuyou_collection` / `kuyou_payment` 收付款单，冲减客户 `need_receive_account` / 供应商 `need_give_account`、登记应收/应付明细（`kuyou_accounts_receivable` / `kuyou_accounts_copewith`）与账户流水（`kuyou_accounts_log`）、更新结算账户余额，并写操作日志。前端「资金 → 收付款核销」页调用。
- ✅ **库存盘点过账**：`StocktakeModule` 新增 `kuyou_stocktake` + `kuyou_stocktake_info` 盘点单（建单带入系统库存），`stocktake/post` 按盘盈（business_type=8）/ 盘亏（business_type=10）写 `kuyou_goods_log` 并校正 `kuyou_goods.inventory`。前端「仓库 → 库存盘点过账」页调用。
- ✅ **操作日志 + 通用导出**：`DataModule` 提供 `kuyou_operate_log` 操作日志查看与通用 CSV 导出（商品/客户/供应商/盘点单）。前端「设置 → 操作日志/导出」页调用。

对照 `erp文档/` 的 102 张原系统截图：
- **基础资料类**（商品/仓库/客户/供应商/职员/账户/单位/分类/收支类别/结算方式/辅助属性/车间/委外工厂/司机/自取地址/轮播/系统配置/用户）→ 通用 CRUD 页已全覆盖
- **业务单据类**（购货/销货及其订单与退货、**零售/零售退货**、调拨、盘点、序列号盘点、其他出入库、组装拆卸、成本调整、收款付款、资金转账、核销、其他收支、订货单、生产计划/生产单/领料/委外/验收）→ 单据页已覆盖 **30 类**
- **报表类**（采购/销售/库存/资金四大类）→ 报表页已覆盖 **27 张**
- **计算型页面**（MRP 计算/智能补货/已销订购看板/计件计时工资/结账反结账/系统初始化）→ 专项业务页 **6 个**全部补齐
- **打印中心**：`prints/*` 单据/汇总表打印，覆盖采购/销售/退换货/调拨/盘点/组装拆卸/收付款/核销/其他收支 **17 类单据** + 采购明细/订单跟踪/采购汇总/付款流水/销售跟踪 **6 类汇总表**，含人民币大写与打印次数自增
- **开票登记**：`Invoicing` / `SalesInvoicing` 采购/销货开票登记 + 台账冲销
- **往来欠款**：`Intercourse` 客户应收 / 供应商应付对账表
- **数据中心**：`Datainfo` 近 7 日购货/销货趋势、按仓库库存统计、账户资金统计、本月购销汇总看板
- **BOM 配方 / 工序**：`Bom` 清单 + `Procedure` 工序主从编辑，明细行增删后自动回算清单数量/金额合计

### 端点覆盖审计

自带的审计脚本会抽取源系统 PC 前端（JS + 视图）引用的全部 `kuyou/<模块>/<方法>` 端点，
与目标端 NestJS 路由逐一比对，输出覆盖率与未覆盖明细：

```bash
node backend/scripts/audit-endpoints.js
```

当前结果：**562 个源端点 / 562 已覆盖（100%）**，**113 个源后台页面模块 / 113 已覆盖（100%，通用 88 + 专用页面 25）**，PC 管理后台无功能缺口。

```bash
node backend/scripts/audit-pages.js     # 页面模块覆盖审计（另含 289 个视图文件映射）
```

不影响上述通用能力：
- ✅ **移动端小程序（前端，开源）**：仓库已附带 `订货通小程序/`（uniapp vue3，客户订货商城）与 `生产小程序/`（uniapp Vue3，MES 生产现场）两套开源 uniapp 前端，对接同一 NestJS 后端，详见上方「移动端小程序（开源）」章节。原系统 `api/controller/applet/*`（共 100+）的后端接口按小程序实际调用按需补齐，PC 管理后台口径不受影响。
- ℹ️ **MES 生产小程序后端**：原压缩包未提供 MES 后端实现；本仓库 `生产小程序/` 为前端源码，其所需的生产类接口复用 PC 端的单据 / 专项引擎（`/kuyou/*`）。
- ℹ️ 截图 1「概述」、2「常见问题」、3「系统运行部分问题」、101「安装注意事项」为文档说明页，非功能页面

> **已知口径差异**：结账的销售成本回填实现了移动平均（valuation=1）与先进先出（valuation=2）两种口径；
> 原系统 `library/Checkout` 在 FIFO 下还会处理「跨期间的批次重排 warehouses 维度」等分支，
> 本项目按主线算法对齐，极端场景（同一秒多批次、跨仓调价）的结果可能与原系统在尾数上有差异。

---

## 扩展一个新模块

方式一（推荐，零代码）：新表加入 `db/schema.sql` 后重跑
```bash
python backend/scripts/gen-table-meta.py   # 重新生成后端白名单 + 前端菜单
```
后端自动多出 `/kuyou/<新表>/*` 接口，前端菜单自动多出对应页面。

方式二（自定义业务 action）：在 `src/modules/erp/` 下新建控制器，写具体业务方法（如过账），路由仍挂 `kuyou/<模块>/<方法>`，与动态 CRUD 共存。

---

## 重新生成元数据

改动数据库结构后，可重跑以下生成器以同步前后端：
```bash
python backend/scripts/gen-entities.py      # 重新生成 156 个实体
python backend/scripts/gen-table-meta.py    # 重新生成 table-meta.ts + modules.ts
node backend/scripts/gen-table-comments.js  # 重新生成 table-comments.ts（通用导入的列注释映射）
```

---

## 开源相关

### 许可证（License）
本项目以 **MIT License** 开源，详见仓库根目录 [`LICENSE`](./LICENSE)。

> 本项目是对原 kuyou 进销存系统的**接口与业务口径重构**（重写为 NestJS + Vue3），仅用于学习与技术交流。**若用于商业用途，请遵守原系统的许可协议及所在地区的法律法规。**

### 贡献指南（Contributing）
欢迎提交 Issue 与 Pull Request，细节见 [`CONTRIBUTING.md`](./CONTRIBUTING.md)。基本原则：

- **优先复用四大引擎**：新增业务优先走 动态 CRUD / 单据 / 报表 / 专项 引擎；确需独立 action 时，在 `src/modules/erp/` 下新建模块，路由仍挂 `kuyou/<模块>/<方法>`，与动态 CRUD 共存（静态路由优先于 `:table/*` 通配，不会冲突）。
- **SQL 安全第一**：所有动态拼 SQL 必须走 `TABLE_META` 白名单 + 参数化，杜绝注入。
- **改动表结构后**：重跑元数据生成脚本（`gen-entities.py` / `gen-table-meta.py` / `gen-table-comments.js`）并同步前后端。
- **提交前自检**：
  ```bash
  npm run build                       # 后端 nest build
  npm run verify:ui                   # 前端 vue-tsc + vite build
  npm run check:ds                    # 前端 UI 绑定自检
  node backend/scripts/audit-endpoints.js   # 端点覆盖审计
  ```

### 目录与脚本速查
| 用途 | 命令 |
| --- | --- |
| 端点覆盖审计 | `node backend/scripts/audit-endpoints.js` |
| 页面覆盖审计 | `node backend/scripts/audit-pages.js` |
| 前端 UI 绑定自检 | `npm run check:ds` |
| 运行时冒烟（真浏览器） | `npm run smoke:ui` |
| 元数据重新生成 | `python backend/scripts/gen-entities.py` / `gen-table-meta.py` |

### 行为准则
参与本项目的交流与贡献请保持友善、尊重，聚焦技术问题；禁止任何形式的骚扰、歧视或攻击性言论。
