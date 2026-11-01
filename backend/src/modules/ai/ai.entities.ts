import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/* =========================================================================
 * AI 模块数据模型（新增，原 kuyou 无此能力）
 * 所有表以 kuyou_ai_ 前缀，与原库风格一致
 * ========================================================================= */

/** 模型配置（模型配置数据库化） */
@Entity('kuyou_ai_model_config')
export class AiModelConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 100, nullable: false, default: '', comment: '配置名称' })
  name: string;

  @Column({ name: 'provider', type: 'varchar', length: 50, nullable: false, default: 'openai', comment: '供应商(openai/deepseek/...)' })
  provider: string;

  @Column({ name: 'base_url', type: 'varchar', length: 255, nullable: false, default: '', comment: 'OpenAI 兼容接口地址' })
  baseUrl: string;

  @Column({ name: 'api_key', type: 'varchar', length: 255, nullable: false, default: '', comment: 'API Key' })
  apiKey: string;

  @Column({ name: 'model', type: 'varchar', length: 100, nullable: false, default: '', comment: '模型名称' })
  model: string;

  @Column({ name: 'temperature', type: 'double', nullable: false, default: 0.7, comment: '温度' })
  temperature: number;

  @Column({ name: 'max_tokens', type: 'int', nullable: false, default: 2048, comment: '最大 token' })
  maxTokens: number;

  @Column({ name: 'enabled', type: 'tinyint', nullable: false, default: 1, comment: '是否启用' })
  enabled: number;

  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}

/** Prompt 模板管理 */
@Entity('kuyou_ai_prompt_template')
export class AiPromptTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'code', type: 'varchar', length: 100, nullable: false, default: '', comment: '模板编码(唯一)' })
  code: string;

  @Column({ name: 'name', type: 'varchar', length: 100, nullable: false, default: '', comment: '模板名称' })
  name: string;

  @Column({ name: 'content', type: 'text', nullable: true, comment: '模板内容，支持 {{var}} 占位' })
  content: string;

  @Column({ name: 'variables', type: 'varchar', length: 255, nullable: true, default: '', comment: '变量名(逗号分隔)' })
  variables: string;

  @Column({ name: 'description', type: 'varchar', length: 255, nullable: true, default: '', comment: '说明' })
  description: string;

  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}

/** 工具注册元数据（Function Calling 工具定义，数据库化） */
@Entity('kuyou_ai_tool')
export class AiTool {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 100, nullable: false, default: '', comment: '工具名称(函数名)' })
  name: string;

  @Column({ name: 'description', type: 'varchar', length: 500, nullable: false, default: '', comment: '工具描述' })
  description: string;

  @Column({ name: 'parameters', type: 'text', nullable: true, comment: 'JSON Schema 参数定义' })
  parameters: string;

  @Column({ name: 'enabled', type: 'tinyint', nullable: false, default: 1, comment: '是否启用' })
  enabled: number;

  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}

/** 知识库（关键词检索语料） */
@Entity('kuyou_ai_knowledge')
export class AiKnowledge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: false, default: '', comment: '标题' })
  title: string;

  @Column({ name: 'content', type: 'text', nullable: true, comment: '正文' })
  content: string;

  @Column({ name: 'keywords', type: 'varchar', length: 500, nullable: true, default: '', comment: '关键词(逗号分隔)' })
  keywords: string;

  @Column({ name: 'source', type: 'varchar', length: 255, nullable: true, default: '', comment: '来源' })
  source: string;

  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}

/** AI 调用日志 */
@Entity('kuyou_ai_call_log')
export class AiCallLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'model_config_id', type: 'int', nullable: true, comment: '模型配置ID' })
  modelConfigId: number;

  @Column({ name: 'model', type: 'varchar', length: 100, nullable: true, comment: '实际模型' })
  model: string;

  @Column({ name: 'prompt', type: 'text', nullable: true, comment: '系统提示/目标' })
  prompt: string;

  @Column({ name: 'request', type: 'text', nullable: true, comment: '请求体(JSON)' })
  request: string;

  @Column({ name: 'response', type: 'text', nullable: true, comment: '响应内容' })
  response: string;

  @Column({ name: 'prompt_tokens', type: 'int', nullable: true, comment: '输入token' })
  promptTokens: number;

  @Column({ name: 'completion_tokens', type: 'int', nullable: true, comment: '输出token' })
  completionTokens: number;

  @Column({ name: 'total_tokens', type: 'int', nullable: true, comment: '总token' })
  totalTokens: number;

  @Column({ name: 'duration_ms', type: 'int', nullable: true, comment: '耗时(ms)' })
  durationMs: number;

  @Column({ name: 'status', type: 'tinyint', nullable: false, default: 1, comment: '状态:1成功,0失败' })
  status: number;

  @Column({ name: 'error', type: 'text', nullable: true, comment: '错误信息' })
  error: string;

  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;
}

/** 工具调用日志 */
@Entity('kuyou_ai_tool_call_log')
export class AiToolCallLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'call_log_id', type: 'int', nullable: true, comment: '关联AI调用日志ID' })
  callLogId: number;

  @Column({ name: 'tool_name', type: 'varchar', length: 100, nullable: true, comment: '工具名' })
  toolName: string;

  @Column({ name: 'arguments', type: 'text', nullable: true, comment: '入参(JSON)' })
  arguments: string;

  @Column({ name: 'result', type: 'text', nullable: true, comment: '返回结果' })
  result: string;

  @Column({ name: 'status', type: 'tinyint', nullable: false, default: 1, comment: '状态:1成功,0失败' })
  status: number;

  @Column({ name: 'duration_ms', type: 'int', nullable: true, comment: '耗时(ms)' })
  durationMs: number;

  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;
}
