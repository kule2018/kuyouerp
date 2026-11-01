# 07 · 前端设计系统（DeepSeek UI）

前端界面**完全由项目自带的设计系统承载**，不依赖任何第三方 UI 组件库（如 Element‑Plus）。它分「原子层」与「业务层」两级，统一主题、统一交互。

---

## 1. 分层结构

位于 `frontend/src/components/`：

| 层 | 路径 | 说明 |
| --- | --- | --- |
| 原子层 | `components/ds/` | 基础组件 `DsButton / DsInput / DsSelect / DsTable / DsMenu / DsModal / DsDrawer / DsTabs / DsPagination / DsDatePicker / DsTag / DsTree / DsTreeSelect / DsUploader / DsMarkdown / DsDescriptions / DsPopover / DsToast / DsConfirm …`，配套 `theme.css`（`--ds-*` 设计令牌，明 / 暗双主题） |
| 业务层 | `components/Base*.vue` | `BaseForm / BaseGrid / BaseDrawer / BaseDialog / BaseSelect / BaseUpload / StatCard / Panel …`，组合原子层以适配 ERP 业务 |

### 全局注册

入口 `main.ts` 调用 `installDsUi(app)` 一次性全局注册全部组件并加载主题，**页面无需逐个 import**。同时注册 `v-permission` 指令与持久化权限的还原。

```ts
import { installDsUi } from './components';
const app = createApp(App);
installDsUi(app);
app.directive('permission', permissionDirective);
app.mount('#app');
```

---

## 2. 为承接进销存业务增强的能力

原子层在通用能力之外，针对 ERP 场景做了扩展：

| 组件 | 增强能力 |
| --- | --- |
| `DsTable` | 行多选（含全选）、跨页保留勾选、固定列（left / right 吸附）、服务端排序、行合并 `span-method`、页脚合计 `show-summary`、受控 / 非受控选中态 |
| `DsMenu` | 递归嵌套子菜单（模块 → 分组 → 菜单项），自动展开选中路径、折叠态 Tooltip；叶子节点渲染为真实链接，支持新标签页打开，普通点击走 SPA 路由 |
| `DsSelect` | `remote` + `@search` 远程搜索（商品 / 客户等异步检索） |
| `DsInput` | 原生 `min / max / step` 透传（金额精度 0.01、单价 0.0001 等） |
| `DsConfirm` + `useConfirm` | Promise 风格确认，替代 `window.confirm` |
| `DsToast` + `useToast` | success / error / warning / info 提示 |

布局原语（容器 / 栅格等）改为原生 `div` + `theme.css` 令牌实现。

---

## 3. 主题与暗色模式

`theme.css` 定义 `--ds-*` 设计令牌（颜色、间距、圆角、阴影等），顶部切换按钮在 `light` / `dark` 间切换并持久化。页面样式应优先使用令牌而非硬编码颜色，保证双主题一致。

---

## 4. 通用页面（由元数据驱动）

| 路由 | 页面 | 驱动配置 |
| --- | --- | --- |
| `/crud/:table` | `views/crud.vue` | `config/modules.ts`（列 / 表单 / 菜单元数据） |
| `/doc/:table` | `views/document.vue` | `config/documents.ts`（单据字段 / 明细 / 引用数据源） |
| `/report/:key` | `views/report.vue` | `config/reports.ts`（报表定义） |
| `/special/:type` | `views/special.vue` | 内置 6 类专项计算 |
| `/ai` | `views/ai.vue` | AI 控制台 |
| `/pos` | `views/pos.vue` | POS 收银台 |

`config/` 目录其它关键文件：`menu.ts`（菜单）、`relations.ts`（外键字典）、`required-fields.ts`（必填校验）、`table-extras.ts`（表级扩展按钮与列表富化）、`source-docs.ts`（源文档引用）。这些文件多数由后端元数据脚本生成，请勿手工大量改动，应改 `schema.sql` 后重跑生成器。

---

## 5. 提交前自检：UI 绑定

元素属性名迁移遗漏时 Vue **不会报错**，而是静默透传到根元素，导致功能悄悄失效（典型如 `reserve-selection`、`step`）。仓库提供自检脚本：

```bash
npm run check:ds          # 等价于 node scripts/check-ds-bindings.cjs
```

它扫描 `views/` 与 `components/` 模板中对 Ds 组件的**全部绑定**（动态 `:prop` / `@event` / 静态属性），与组件自身的 `defineProps` / `defineEmits` 逐一比对，输出失效清单；无问题时打印「无失效绑定 ✓」并以 0 退出，适合接入 CI。

---

## 6. 运行时冒烟（真浏览器巡检）

`vue-tsc` 只能保证静态类型，组件未注册、模板取值错误、生命周期异常等**运行时问题它抓不到**。仓库提供真浏览器巡检：

```bash
npm run build                       # 产出 dist
npm run preview                     # 另开终端：http://localhost:4173
npm run smoke:ui                    # node scripts/smoke-ui.cjs http://localhost:4173
```

脚本行为：
1. 驱动本机 Edge（可用 `EDGE_PATH` 覆盖），注入假 token 绕过登录守卫；
2. 拦截所有 `/kuyou/**` 请求返回通用空数据信封，因此**不依赖 MySQL 与后端进程**；
3. 用 esbuild 即时转译前端配置取真源，拼出全量路由后逐页访问，按页收集 `console.error` 与未捕获异常。

> 返回裸数组（非 `{code,data}` 信封）的端点需在脚本的 `ARRAY_ENDPOINTS` 中登记（如 `/prints/types`），否则会误判为运行时错误。

---

## 7. 不装数据库也能看 UI（mock 后端）

`scripts/mock-server.cjs` 从 `config/modules.ts` 按列类型造值，让每个列表列都填得满，便于排查排版：

```bash
npm run build
npm run mock                                       # http://127.0.0.1:3100
BACKEND_ORIGIN=http://127.0.0.1:3100 npm run preview # preview 把 /kuyou 指到 mock
```

`PORT` / `ROWS` 环境变量可改端口与每接口行数。

---

## 8. 目录速查

```
frontend/src/
├── api/            # 接口封装（dynamic / document / report / ai / bom …）
├── components/     # DeepSeek UI：ds/ 原子层 + Base* 业务层 + index.ts
├── config/         # modules / documents / reports / relations / menu …
├── directives/     # permission 指令
├── permission/     # 权限判定
├── router/         # 路由表（通用页 + 参数）
├── store/          # 认证 / 权限状态
├── utils/          # 工具函数
├── views/          # 页面（login / layout / dashboard / crud / document / report / pos / ai …）
├── App.vue
├── main.ts         # 入口：installDsUi + 权限指令
└── env.d.ts
```

下一章 [08 · 开发指南](./08-development.md) 介绍如何扩展模块与脚本工具。
