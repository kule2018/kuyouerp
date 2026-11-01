# 04 · 数据库设计

本章介绍数据库约定、初始化脚本、扩展表，以及「改动表结构后如何同步前后端元数据」。

---

## 1. 基本约定

- **数据库**：MySQL 8，引擎 `InnoDB`，字符集 `utf8mb4`（含 `utf8mb4_unicode_ci` / `utf8mb4_general_ci`）。
- **表名前缀**：所有业务表统一以 `kuyou_` 开头（如 `kuyou_goods`、`kuyou_goods_sales`），便于动态 CRUD 路由按前缀识别与白名单管控。
- **实体**：`backend/src/entities/` 下由 `db/schema.sql` 生成的 TypeORM 实体（约 156 张），配合 `TypeOrmModule.forRoot` 的 `autoLoadEntities`，各模块通过 `forFeature` 注册即可自动加载。
- **同步策略**：`.env` 中 `DB_SYNCHRONIZE=false`。表结构以 `db/*.sql` 脚本为准，TypeORM **不**自动建表 / 改表，避免生产环境意外变更。

---

## 2. 初始化脚本（`db/` 目录）

| 文件 | 作用 | 执行顺序 |
| --- | --- | --- |
| `schema.sql` | 全量建表 + 初始数据（地区、单位、分类等基础字典） | ① 先建库后执行 |
| `seed.sql` | 管理员账号（默认 `admin / 123456`） | ② |
| `ai-tables.sql` | AI 能力层所需表（不接 AI 也可执行） | ③ |
| `finance-stocktake-tables.sql` | 收付款核销 / 库存盘点 / 操作日志 扩展表 | ④（在 schema 之后） |

典型初始化命令见 [02 · 快速开始](./02-quick-start.md) 第 3 节。

> 说明：业务表数量较多（约 156 张），涵盖基础资料、采购、销售、库存、生产、财务、报表配置、系统设置等。新增业务表时，请将建表语句补入 `schema.sql` 并在文档中登记。

---

## 3. 元数据：前后端共享的「真相来源」

为避免前后端对表结构各维护一份、产生漂移，项目用脚本从 `schema.sql` 中解析出元数据，分别生成：

| 生成物 | 生成脚本 | 用途 |
| --- | --- | --- |
| `backend/src/table-meta.ts` | `scripts/gen-table-meta.py` | 后端表 / 列白名单（防注入） |
| `frontend/src/config/modules.ts` | `scripts/gen-table-meta.py` | 前端全量菜单 + 列 / 表单元数据 |
| `backend/src/entities/*.ts` | `scripts/gen-entities.py` | TypeORM 实体 |
| `backend/src/table-comments.ts` | `scripts/gen-table-comments.js` | 列注释映射（通用 Excel 导入按注释匹配表头） |

`gen-table-meta.py` 的解析规则包括：
- 表名 / 列名 / 类型 / 主键 / 软删字段（`deletetime`）抽取；
- 列注释（COMMENT）作为中文标签；
- `enum(...)` 类型解析为下拉枚举；
- 自动维护字段（`id / createtime / updatetime / deletetime / admin_id` 等）在前端标记为不可编辑；
- 按表名关键字分组（采购 / 销售 / 库存 / 生产 / 财务 / 基础资料 …）生成侧边菜单。

---

## 4. 扩展 / 新增表的标准流程

当你需要加一张业务表（例如 `kuyou_my_feature`）：

1. 在 `db/schema.sql` 中增加 `CREATE TABLE IF NOT EXISTS kuyou_my_feature (...)`；
2. 在 MySQL 中执行该建表语句；
3. 重跑元数据生成脚本（见下）；
4. 后端自动多出 `/kuyou/kuyou_my_feature/*` 接口，前端菜单自动多出对应 CRUD 页面——**零业务代码**。

如需自定义业务动作（如过账），在 `modules/erp/` 下新建模块，路由仍挂 `kuyou/<模块>/<方法>`，与动态 CRUD 的 `:table/*` 通配共存（**静态路由优先**，不会冲突）。

---

## 5. 重生成元数据

改动数据库结构后，务必重跑以下脚本并同步前后端：

```bash
# 后端实体
python backend/scripts/gen-entities.py
# 后端白名单 + 前端菜单 / 列元数据
python backend/scripts/gen-table-meta.py
# 列注释映射（通用导入用）
node backend/scripts/gen-table-comments.js
```

> 这些脚本是「约定优于配置」的关键：只要 `schema.sql` 写得规范（带 COMMENT、外键命名清晰），前端就能自动获得正确标签、下拉与表单。

---

## 6. 软删除约定

含 `deletetime` 列的表，删除时由动态 CRUD 自动走**软删除**（写入删除时间而非物理删除），列表默认过滤已删除行；回收站模块可对软删数据做恢复 / 彻底销毁。

下一章 [05 · 接口规范](./05-api.md) 汇总所有对外接口。
