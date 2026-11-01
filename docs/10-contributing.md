# 10 · 贡献与许可证

感谢你关注 **kuyou-nestjs-vue**！我们欢迎以 Issue、Pull Request、文档修正等方式参与项目。

---

## 1. 行为准则

参与交流、提问与贡献时，请保持友善、尊重，聚焦技术问题；禁止任何形式的骚扰、歧视或攻击性言论。违规者可能被维护者移出贡献者名单。

---

## 2. 提交流程

1. Fork 本仓库，基于 `main`（或约定的默认分支）创建特性分支：`feat/xxx`、`fix/xxx`。
2. 本地开发与自测（见下方「本地自检」）。
3. 提交信息建议遵循约定式提交（Conventional Commits）：
   - `feat:` 新功能 / 新模块
   - `fix:` 缺陷修复
   - `docs:` 文档
   - `refactor:` 重构（不改变外部行为）
   - `test:` 测试
   - `chore:` 构建 / 工具
4. 发起 Pull Request，描述动机、改动点与自测结果。

---

## 3. 开发约定

### 后端
- **优先复用四大引擎**：新增业务优先走 动态 CRUD / 单据 / 报表 / 专项 引擎；确需独立 action 时，在 `src/modules/erp/` 下新建模块，路由仍挂 `kuyou/<模块>/<方法>`，与动态 CRUD 共存（静态路由优先）。
- **SQL 安全**：所有动态拼 SQL 必须走 `TABLE_META` 表 / 列白名单，取值全部参数化。
- **事务一致性**：多表写入请在事务内完成，失败回滚。
- **统一返回**：使用 `common/utils/resp` 的 `ok / table / err`，结构 `{code, msg, data}`；列表 `{total, rows}`。

### 前端
- UI 组件统一使用 `src/components/ds`（DeepSeek UI 设计系统），**不要引入第三方 UI 组件库**。
- 复用 `views/crud.vue`、`views/document.vue`、`views/report.vue` 等通用页；新增专用页请在 `router/index.ts` 与菜单中登记。
- 模板绑定需与组件 `defineProps` / `defineEmits` 一致，提交前跑 `npm run check:ds`。

### 数据库结构变更
改动表结构后，务必重跑元数据生成脚本并同步前后端（见 [08 · 开发指南](./08-development.md) 第 3 节）。新增表还需补建表 SQL 到 `db/` 并在快速开始中登记。

---

## 4. 本地自检

```bash
# 后端
cd backend && npm install && npm run build

# 前端
cd frontend && npm install && npm run verify:ui   # vue-tsc + vite build
npm run check:ds                                  # UI 绑定自检

# 接口覆盖审计（可选）
node backend/scripts/audit-endpoints.js
```

---

## 5. 问题反馈

- **Bug / 需求**：通过 Issue 描述复现步骤、期望与实际表现、相关日志。
- **安全漏洞**：请私信维护者，勿公开披露。

---

## 6. 许可证（License）

本项目以 **MIT License** 开源，完整文本见仓库根目录 [`LICENSE`](./LICENSE)。

MIT 要点：
- 允许免费使用、复制、修改、合并、发布、分发、再许可与销售；
- 需在软件副本及相关文档中保留版权声明与许可声明；
- 软件按「原样」提供，不提供任何明示或暗示的担保，作者不对任何索赔或损失负责。

> 本项目代码自包含、可独立编译运行。若将其用于商业用途，请遵守所在地区相关法律法规，并自行承担相应责任。

---

## 7. 目录与脚本速查

| 用途 | 命令 |
| --- | --- |
| 端点覆盖审计 | `node backend/scripts/audit-endpoints.js` |
| 页面覆盖审计 | `node backend/scripts/audit-pages.js` |
| 前端 UI 绑定自检 | `npm run check:ds` |
| 运行时冒烟（真浏览器） | `npm run smoke:ui` |
| 元数据重新生成 | `python backend/scripts/gen-entities.py` / `gen-table-meta.py` / `node backend/scripts/gen-table-comments.js` |
| 不依赖数据库预览 UI | `npm run mock` + `BACKEND_ORIGIN=... npm run preview` |

至此，开源文档全部章节已完成。建议从 [01 · 项目简介](./01-introduction.md) 开始阅读，或直接跳到需要的章节。
