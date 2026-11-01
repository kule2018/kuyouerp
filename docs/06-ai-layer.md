# 06 · AI 能力层

本章介绍内置的 AI 能力层。它是一套 **OpenAI 兼容** 的对话 / Agent / 工具调用框架，把「自然语言」转化为对业务数据的查询与操作。AI 为**可选模块**：不配置密钥时，其余 ERP 功能完全不受影响。

---

## 1. 设计目标

把大模型能力以「可配置、可审计、可扩展」的方式接入系统：

- **模型可配置**：API 地址、密钥、模型名、温度等存数据库，运行时动态加载，无需改代码；
- **Prompt 模板化**：支持 `{{变量}}` 渲染，便于复用与版本管理；
- **工具调用**：用装饰器声明业务工具（如查商品、查客户、计算器），由框架自动收集并执行；
- **Agent 多轮**：ReAct 式循环（调用 → 执行工具 → 回灌 → 再决策）；
- **知识检索**：关键词评分召回，把命中内容作为上下文；
- **结构化输出**：通过 `response_format` 约束模型返回 JSON；
- **全量日志**：对话与工具调用均落库，便于排查与合规。

---

## 2. 后端结构

位于 `backend/src/modules/ai/`：

| 文件 | 职责 |
| --- | --- |
| `ai.module.ts` | 模块装配 |
| `ai.controller.ts` | 对外 HTTP 接口 |
| `ai.entities.ts` | AI 相关实体（模型配置 / Prompt / 知识库 / 日志） |
| `chat-client.service.ts` | OpenAI 兼容 ChatClient（system prompt / tools / 结构化 JSON） |
| `model-config.service.ts` | 模型配置库 + `toClientConfig` 动态加载 |
| `prompt-template.service.ts` | Prompt 模板 + `{{var}}` 变量渲染 |
| `tool.decorator.ts` + `tool-callbacks.ts` | `@Tool` 装饰器与工具收集 / 执行 |
| `agent.service.ts` | Agent 多轮自主执行（ReAct） |
| `keyword-retrieval.service.ts` | 知识库关键词检索与评分召回 |
| `ai-log.service.ts` | 调用 / 工具调用日志写入 |
| `recognition.service.ts` / `analysis.service.ts` | 识别 / 分析辅助能力 |

内置示例工具：`query_goods`（查商品）、`query_customers`（查客户）、`calculator`（计算器）。

---

## 3. 接口一览

| 能力 | 路由 |
| --- | --- |
| 对话 | `POST /kuyou/ai/chat` |
| Agent 执行 | `POST /kuyou/ai/agent` |
| 知识检索 | `POST /kuyou/ai/retrieve` |
| 工具列表 | `GET  /kuyou/ai/tools` |
| 模型配置 CRUD | `/kuyou/ai/model-config` |
| Prompt 模板 CRUD | `/kuyou/ai/prompt-template` |
| 知识库 CRUD | `/kuyou/ai/knowledge` |
| 调用日志查询 | `/kuyou/ai/call-log` |

---

## 4. 配置与启用

1. 初始化 AI 表：执行 `db/ai-tables.sql`；
2. 在 `.env` 填写（参考 `backend/.env.example`）：

```ini
AI_DEFAULT_BASE_URL=https://api.deepseek.com/v1
AI_DEFAULT_API_KEY=sk-xxxx
AI_DEFAULT_MODEL=deepseek-chat
AI_DEFAULT_TEMPERATURE=0.7
AI_DEFAULT_MAX_TOKENS=2048
```

该默认配置作为兜底；更推荐在「AI 控制台 → 模型配置」中**数据库化**管理多套模型（可指向 DeepSeek / OpenRouter / 本地 vLLM 等任意 OpenAI 兼容服务）。
3. 前端「侧边栏 → AI 助手」进入控制台，提供对话、Agent 执行、检索、模型 / Prompt / 知识库管理、调用日志六个页签。

---

## 5. 自定义一个业务工具

只需用 `@Tool` 装饰器声明，框架会自动收集并生成 function 定义、按名执行：

```ts
import { Tool } from './tool.decorator';

export class ErpTools {
  @Tool({
    name: 'query_goods',
    description: '按关键字查询商品库存与价格',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '商品名称或编码' },
      },
      required: ['keyword'],
    },
  })
  async queryGoods(args: { keyword: string }) {
    // 调用动态 CRUD 或仓储查询，返回结构化结果
    return { ... };
  }
}
```

注册后在 Agent 对话中，模型便能在需要时自动调用它，结果回灌模型继续推理。

---

## 6. 知识库检索

`KeywordRetrievalService` 对知识条目做关键词命中与评分召回，把 top‑N 结果作为上下文拼入 Prompt。适用于「把企业制度 / 商品手册 / 操作规范喂给模型」的场景。

---

## 7. 调用与工具日志

每次对话与每次工具执行都会写入 `AiCallLog` / `AiToolCallLog`，记录模型、输入、输出、耗时、token 等。可在 AI 控制台「调用日志」页签查看，用于审计、复盘与成本统计。

> 注意：AI 模块会向第三方模型服务发送数据。请仅在可信环境配置密钥，并遵守所用模型服务的使用条款与数据合规要求。
