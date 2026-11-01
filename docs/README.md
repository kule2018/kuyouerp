# kuyou-nestjs-vue 开源文档中心

欢迎阅读 **kuyou-nestjs-vue** 的官方开源文档。

kuyou-nestjs-vue 是一套基于 **NestJS + Vue 3** 构建的开源进销存（ERP）管理系统。它以「数据驱动 + 引擎化」的设计思路，把企业日常经营中常见的 **基础资料、业务单据、统计报表、专项计算** 四类页面抽象为四个通用引擎，配合一套自建的 DeepSeek 风格前端设计系统，提供开箱即用的进销存能力，并内置可扩展的 AI 能力层。

> 本仓库代码自包含、可独立运行，不依赖任何外部私有服务。文档中所有内容均围绕本项目的实现展开。

---

## 文档导航

| 章节 | 内容 |
| --- | --- |
| [01 · 项目简介](./01-introduction.md) | 这是什么、核心特性、技术栈、适用场景 |
| [02 · 快速开始](./02-quick-start.md) | 环境要求、数据库初始化、启动后端 / 前端、登录体验 |
| [03 · 系统架构](./03-architecture.md) | 分层设计、四大引擎原理、模块清单 |
| [04 · 数据库设计](./04-database.md) | 表结构约定、初始化脚本、扩展表、元数据生成 |
| [05 · 接口规范](./05-api.md) | 全局约定、CRUD / 单据 / 报表 / 专项 / 财务 / 盘点 / 导出接口 |
| [06 · AI 能力层](./06-ai-layer.md) | 对话、Agent、工具调用、知识检索、模型与提示词管理 |
| [07 · 前端设计系统](./07-frontend-ui.md) | DeepSeek UI 原子层 / 业务层、主题、自检与冒烟 |
| [08 · 开发指南](./08-development.md) | 扩展新模块、脚本工具、安全规范、提交前自检 |
| [09 · 部署上线](./09-deployment.md) | 生产构建、反向代理、环境变量 |
| [10 · 贡献与许可证](./10-contributing.md) | 行为准则、贡献流程、MIT 许可证 |

---

## 仓库结构速览

```
kuyou-nestjs-vue/
├── backend/                 # NestJS 后端（TypeScript）
│   ├── scripts/             # 元数据生成 / 审计脚本（Python + Node）
│   ├── src/
│   │   ├── common/          # 守卫 / 异常过滤器 / 统一响应 / 基础服务
│   │   ├── config/          # 数据库等配置
│   │   ├── entities/        # 由 schema 生成的 TypeORM 实体
│   │   ├── modules/         # auth / rbac / ai / erp（四大引擎 + 业务模块）
│   │   ├── table-meta.ts    # 表元数据白名单（生成）
│   │   └── table-comments.ts# 列注释映射（生成）
│   └── package.json
├── frontend/                # Vue 3 前端（TypeScript + Vite）
│   └── src/
│       ├── api/             # 接口封装
│       ├── components/      # DeepSeek UI 设计系统（ds 原子层 + Base 业务层）
│       ├── config/          # 菜单 / 单据 / 报表 / 关联 等元数据
│       ├── router/          # 路由表
│       ├── views/           # 页面（登录 / 布局 / 仪表盘 / CRUD / 单据 / 报表 / POS / AI …）
│       └── main.ts          # 入口（全局注册 UI + 权限）
├── db/                      # 数据库初始化 SQL
│   ├── schema.sql           # 全量建表 + 初始数据
│   ├── seed.sql             # 管理员账号
│   ├── ai-tables.sql        # AI 能力层表
│   └── finance-stocktake-tables.sql  # 收付款 / 盘点 / 操作日志扩展表
├── 订货通小程序/             # 订货端小程序（独立，非管理后台 Web）
├── 生产小程序/               # 生产端小程序（独立）
├── docs/                    # 本文档
├── README.md                # 项目说明（根）
├── CONTRIBUTING.md          # 贡献指南（根）
└── LICENSE                  # MIT 许可证
```

---

## 如何阅读本手册

- **第一次接触**：建议从 [01 · 项目简介](./01-introduction.md) 与 [02 · 快速开始](./02-quick-start.md) 开始，先把它跑起来。
- **要改业务 / 加字段**：看 [03 · 系统架构](./03-architecture.md) 理解引擎，再读 [08 · 开发指南](./08-development.md)。
- **对接接口 / 做二次开发**：查阅 [05 · 接口规范](./05-api.md)。
- **想接 AI / 知识库**：参阅 [06 · AI 能力层](./06-ai-layer.md)。
- **要上线**：直接跳到 [09 · 部署上线](./09-deployment.md)。

如有疑问或发现文档错误，欢迎通过 Issue 反馈。
