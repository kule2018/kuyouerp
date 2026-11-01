# 02 · 快速开始

本章帮助你在本地把项目跑起来。整体流程：初始化数据库 → 启动后端 → 启动前端 → 登录体验。

---

## 1. 环境要求

| 组件 | 版本要求 | 说明 |
| --- | --- | --- |
| Node.js | ≥ 18 | 后端 NestJS 与前端 Vite 构建均需要 |
| MySQL | ≥ 8.0 | 数据库，需开启 `utf8mb4` |
| Python | ≥ 3.8（可选） | 仅在需要**重新生成元数据**时用到 `scripts/*.py` |
| npm | 随 Node 自带 | 安装依赖 |
| Git | 任意 | 拉取代码（可选） |

---

## 2. 获取代码

```bash
git clone <your-repo-url> kuyou-nestjs-vue
cd kuyou-nestjs-vue
```

---

## 3. 初始化数据库

本项目使用 MySQL。请先创建一个名为 `kuyou` 的数据库（字符集 `utf8mb4`）：

```sql
CREATE DATABASE kuyou CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

然后按顺序执行仓库 `db/` 目录下的 SQL 脚本：

```bash
# ① 全量建表 + 初始数据（约 156 张 kuyou_ 表）
mysql -uroot -p kuyou < db/schema.sql

# ② 管理员账号（默认 admin / 123456）
mysql -uroot -p kuyou < db/seed.sql

# ③ AI 能力层所需的表（不接 AI 也可执行，无副作用）
mysql -uroot -p kuyou < db/ai-tables.sql

# ④ 收付款核销 / 盘点 / 操作日志 扩展表（建议在 schema 之后执行）
mysql -uroot -p kuyou < db/finance-stocktake-tables.sql
```

> 若你修改过 `schema.sql`，重跑后建议一并执行第 ③、④ 步以保持表结构一致。

---

## 4. 配置后端

```bash
cd backend
cp .env.example .env
npm install
```

编辑 `.env`（参考 `backend/.env.example`），至少需要确认以下项：

```ini
# 数据库
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=root
DB_DATABASE=kuyou
DB_SYNCHRONIZE=false          # 表结构以 SQL 脚本为准，不自动同步

# JWT
JWT_SECRET=your-secret
JWT_EXPIRES_IN=7200

# 服务端口
PORT=3000

# AI（可选；不填也能启动，仅 AI 模块不可用）
AI_DEFAULT_BASE_URL=https://api.deepseek.com/v1
AI_DEFAULT_API_KEY=sk-xxxx
AI_DEFAULT_MODEL=deepseek-chat
```

启动后端（监听 3000，接口统一前缀 `/kuyou`）：

```bash
npm run start:dev            # 开发模式（带热重载）
# 或 npm run build && npm run start:prod
```

---

## 5. 启动前端

```bash
cd frontend
npm install
npm run dev                  # 默认 5173，已配置 /kuyou 代理到后端 3000
```

浏览器打开 [http://localhost:5173](http://localhost:5173)，使用默认账号登录：

```
用户名：admin
密码：  123456
```

登录后左侧菜单即全部业务模块，顶栏可切换明 / 暗主题。

---

## 6. 不装 MySQL 也能预览 UI（mock 后端）

如果你想**只看一下前端界面**、不准备配置数据库，可以用仓库自带 mock 服务：它按表字段类型生成形状正确的假数据，且**不依赖 MySQL 与后端进程**。

```bash
cd frontend
npm run build
npm run mock                                       # 起 mock 后端：http://127.0.0.1:3100
BACKEND_ORIGIN=http://127.0.0.1:3100 npm run preview # preview 把 /kuyou 指到 mock
# 浏览器打开 http://localhost:4173 ，演示账号 admin / 123456
```

> `mock-server.cjs` 会用 esbuild 读取前端配置按列类型造值，因此每一列都能填得满，便于检查排版。

---

## 7. 常见问题

- **后端启动报数据库连接失败**：检查 `.env` 的 `DB_*` 与 MySQL 是否可达，确认 `kuyou` 库已由 `db/schema.sql` 创建。
- **前端登录后空白 / 接口 404**：确认后端已在 `3000` 运行，且前端 `vite` 代理的 `/kuyou` 指向正确（开发模式默认即指向 `localhost:3000`）。
- **AI 功能不可用**：AI 为可选模块，未配置 `AI_DEFAULT_API_KEY` 时其余功能不受影响；若需使用，请填写有效的 OpenAI 兼容接口密钥。

下一步建议阅读 [03 · 系统架构](./03-architecture.md) 了解四大引擎，或 [05 · 接口规范](./05-api.md) 对接接口。
