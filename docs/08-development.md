# 08 · 开发指南

本章面向二次开发者：如何扩展模块、可用的脚本工具、安全规范，以及提交前的自检清单。

---

## 1. 扩展一个新模块

### 方式一（推荐，零代码）：新增一张表

1. 在 `db/schema.sql` 增加 `CREATE TABLE IF NOT EXISTS kuyou_xxx (...)`（带 `COMMENT`，外键命名清晰）；
2. 在 MySQL 执行该建表语句；
3. 重跑元数据生成脚本（见第 3 节）；
4. 后端自动多出 `/kuyou/kuyou_xxx/*` 接口，前端菜单自动多出对应 CRUD 页面。

> 适用于「基础资料 / 台账」类需求，无需写任何 TS 代码。

### 方式二：自定义业务 action

当需求超出通用 CRUD（如过账、计算、核销），在 `backend/src/modules/erp/` 下新建模块：

```ts
// backend/src/modules/erp/demo/demo.module.ts
import { Module } from '@nestjs/common';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({ controllers: [DemoController], providers: [DemoService] })
export class DemoModule {}
```

```ts
// backend/src/modules/erp/demo/demo.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { DemoService } from './demo.service';

@Controller('kuyou/demo')           // 路由：/kuyou/demo/<方法>
export class DemoController {
  constructor(private readonly svc: DemoService) {}
  @Post('doSomething')
  doSomething(@Body() body: any) {
    return this.svc.handle(body);
  }
}
```

在 `app.module.ts` 的 `imports` 中登记 `DemoModule` 即可。路由挂 `kuyou/<模块>/<方法>`，与动态 CRUD 的 `:table/*` 通配**共存**（静态路由优先，不冲突）。

前端调用：在 `frontend/src/api/` 下新增封装，并在 `router/index.ts` 与菜单中登记专用页（或复用通用页 + 配置）。

---

## 2. 安全规范（务必遵守）

- **动态 SQL 必须走白名单**：所有拼表名 / 列名的地方使用 `table-meta.ts` 的 `TABLE_META` 白名单，取值全部参数化（`?` / 命名参数），杜绝注入。
- **事务一致性**：涉及多表写入（收付款核销、盘点过账、初始化等）请在 TypeORM 事务内完成，失败回滚。
- **统一返回**：使用 `common/utils/resp` 的 `ok / table / err`，结构 `{code, msg, data}`；列表返回 `{total, rows}`。
- **权限**：需要登录的接口加守卫；按钮级控制在 `v-permission` 指令。
- **不要引入第三方 UI 库**：前端统一使用 `components/ds`，保持设计系统一致。

---

## 3. 脚本工具

### 元数据生成（改表结构后必跑）

```bash
python backend/scripts/gen-entities.py        # 重新生成实体
python backend/scripts/gen-table-meta.py      # 重新生成 table-meta.ts + modules.ts
node   backend/scripts/gen-table-comments.js  # 重新生成列注释映射（通用导入）
```

### 覆盖审计

```bash
node backend/scripts/audit-endpoints.js       # 端点覆盖审计：列出全部接口与未覆盖明细
node backend/scripts/audit-pages.js           # 页面模块覆盖审计
```

### 前端自检 / 冒烟

```bash
npm run check:ds          # UI 绑定自检（见 07 章）
npm run smoke:ui          # 真浏览器运行时巡检（见 07 章）
npm run mock              # 不依赖数据库的 mock 后端
```

---

## 4. 提交前自检清单

```bash
# 后端：类型 / 构建
cd backend && npm install && npm run build

# 前端：类型检查 + 构建 + UI 绑定自检
cd frontend && npm install && npm run verify:ui   # 内含 check:ds + vite build

# 接口覆盖审计（可选但推荐）
node backend/scripts/audit-endpoints.js
```

- 新增 / 修改表结构：已重跑元数据脚本并同步前后端；
- 新增动态 SQL：已走 `TABLE_META` 白名单 + 参数化；
- 前端组件属性：已通过 `npm run check:ds`（无失效绑定）；
- 提交信息遵循约定式提交（`feat: / fix: / docs: / refactor: / test: / chore:`）。

---

## 5. 调试技巧

- **后端热重载**：`npm run start:dev` 监听文件变化自动重启。
- **前端代理**：开发模式 `/kuyou` 已由 Vite 代理到 `localhost:3000`，可在浏览器 Network 面板直接观察请求 / 响应结构。
- **mock 数据**：不连库时用 `npm run mock` + `BACKEND_ORIGIN` 预览，快速验证排版。
- **统一响应**：后端异常会被 `AllExceptionsFilter` 归一化，前端 `api/*` 封装统一解包 `{code, msg, data}`。
