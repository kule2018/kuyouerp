# 贡献指南（Contributing）

感谢你考虑为 **kuyou-nestjs-vue** 做出贡献！本项目是对原 kuyou 进销存系统的 NestJS + Vue3 重构，目标是接口与业务口径一比一对齐并保持可扩展。

## 提交流程

1. Fork 本仓库并基于 `main`（或约定分支）创建特性分支：`feat/xxx`、`fix/xxx`。
2. 本地开发与自测（见下方「本地自检」）。
3. 提交信息建议遵循约定式提交（Conventional Commits）：
   - `feat:` 新功能 / 新模块
   - `fix:` 缺陷修复
   - `docs:` 文档
   - `refactor:` 重构（不改变外部行为）
   - `test:` 测试
   - `chore:` 构建/工具
4. 发起 Pull Request，描述动机、改动点与自测结果。

## 开发约定

### 后端
- **优先复用四大引擎**：新增业务优先走 **动态 CRUD / 单据 / 报表 / 专项** 引擎；确需独立 action 时，在 `src/modules/erp/` 下新建模块，路由仍挂 `kuyou/<模块>/<方法>`，与 DynamicCrud 的 `:table/*` 通配共存（静态路由优先）。
- **SQL 安全**：所有动态拼 SQL 必须走 `TABLE_META` 表/列白名单，取值全部参数化，杜绝注入。
- **事务一致性**：涉及多表写入（如收付款核销、盘点过账）请在 `Connection.transaction` 内完成，失败回滚。
- **统一返回**：使用 `common/utils/resp` 的 `ok/table/err`，结构 `{code, msg, data}`；列表返回 `{total, rows}`。

### 前端
- UI 组件统一使用 `src/components/ds`（DeepSeek 设计系统），**不要引入 Element-Plus**。
- 复用 `views/crud.vue`、`views/document.vue`、`views/report.vue` 等通用页；新增专用页请在 `src/router/index.ts` 与 `layout.vue` 菜单中登记。
- 模板绑定需与组件 `defineProps` / `defineEmits` 一致，提交前跑 `npm run check:ds`。

### 数据库结构变更
改动表结构后，务必重跑元数据生成脚本并同步前后端：
```bash
python backend/scripts/gen-entities.py      # 重新生成实体
python backend/scripts/gen-table-meta.py    # 重新生成 table-meta.ts + modules.ts
node backend/scripts/gen-table-comments.js  # 重新生成列注释映射（通用导入）
```
新增表还需补建表 SQL 到 `db/` 并在 README「快速开始」中登记。

## 本地自检

```bash
# 后端
cd backend && npm install && npm run build

# 前端
cd frontend && npm install && npm run verify:ui   # vue-tsc + vite build
npm run check:ds                                  # UI 绑定自检

# 端点覆盖审计
node backend/scripts/audit-endpoints.js
```

## 行为准则
保持友善、尊重，聚焦技术问题；禁止任何形式的骚扰、歧视或攻击性言论。违规可被维护者移出贡献者名单。

## 问题反馈
- Bug / 需求：通过 Issue 描述复现步骤、期望与实际表现、相关日志。
- 安全漏洞：请私信维护者，勿公开披露。
