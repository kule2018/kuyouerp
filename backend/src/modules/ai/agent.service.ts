import { Injectable } from '@nestjs/common';
import { ChatClientService, ChatMessage } from './chat-client.service';
import { ToolCallbacks } from './tool-callbacks';
import { AiLogService } from './ai-log.service';
import { ModelConfigService } from './model-config.service';

/**
 * Agent 多轮自主执行服务
 * 等价 Spring AI 的 Agent/Advisor 循环：
 *   - 把用户目标交给 ChatClient
 *   - 若模型返回 tool_calls，则通过 ToolCallbacks 执行工具，把结果回灌给模型
 *   - 循环直至模型给出最终答复或无工具调用（最多 maxTurns 轮）
 * 每轮调用与工具调用均写入日志。
 */
@Injectable()
export class AgentService {
  constructor(
    private readonly chatClient: ChatClientService,
    private readonly tools: ToolCallbacks,
    private readonly log: AiLogService,
    private readonly modelConfig: ModelConfigService,
  ) {}

  async run(opts: {
    goal: string;
    modelConfigId?: number;
    systemPrompt?: string;
    useTools?: boolean;
    maxTurns?: number;
    responseFormat?: 'text' | 'json' | 'json_schema';
    jsonSchema?: Record<string, any>;
  }) {
    const cfgEntity = opts.modelConfigId
      ? await this.modelConfig.findOne(opts.modelConfigId)
      : await this.modelConfig.findDefault();
    if (!cfgEntity) {
      return { answer: '', steps: [], error: '未配置可用的模型' };
    }
    const cfg = this.modelConfig.toClientConfig(cfgEntity);

    const messages: ChatMessage[] = [];
    if (opts.systemPrompt) {
      messages.push({ role: 'system', content: opts.systemPrompt });
    }
    messages.push({ role: 'user', content: opts.goal });

    const steps: any[] = [];
    let answer = '';
    const maxTurns = opts.maxTurns || 6;
    const useTools = opts.useTools !== false && this.tools.getDefinitions().length > 0;

    for (let turn = 0; turn < maxTurns; turn++) {
      const defs = useTools ? this.tools.getDefinitions() : [];
      const startedAt = Date.now();
      let callLog;
      try {
        const r = await this.chatClient.chat(cfg, {
          messages,
          tools: defs,
          toolChoice: useTools ? 'auto' : 'none',
          responseFormat: opts.responseFormat,
          jsonSchema: opts.jsonSchema,
        });
        const duration = Date.now() - startedAt;
        callLog = await this.log.logCall({
          modelConfigId: cfgEntity.id,
          model: cfg.model,
          prompt: opts.goal,
          request: JSON.stringify({ messages, tools: defs }),
          response: r.content,
          promptTokens: r.usage?.prompt_tokens,
          completionTokens: r.usage?.completion_tokens,
          totalTokens: r.usage?.total_tokens,
          durationMs: duration,
          status: 1,
        });

        if (r.toolCalls && r.toolCalls.length) {
          // 1) 把 assistant 的 tool_calls 写回消息
          messages.push({
            role: 'assistant',
            content: r.content || null,
            tool_calls: r.toolCalls,
          });
          // 2) 逐个执行工具并回灌 tool 消息
          for (const tc of r.toolCalls) {
            let args: Record<string, any> = {};
            try {
              args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
            } catch {
              args = {};
            }
            const tStarted = Date.now();
            const result = await this.tools.call(tc.function?.name, args);
            const tDuration = Date.now() - tStarted;
            await this.log.logToolCall({
              callLogId: callLog.id,
              toolName: tc.function?.name,
              arguments: JSON.stringify(args),
              result,
              status: 1,
              durationMs: tDuration,
            });
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: result,
            });
            steps.push({ type: 'tool', tool: tc.function?.name, args, result });
          }
          continue; // 继续下一轮，让模型基于工具结果决策
        } else {
          messages.push({ role: 'assistant', content: r.content });
          steps.push({ type: 'answer', content: r.content });
          answer = r.content;
          break;
        }
      } catch (e: any) {
        const duration = Date.now() - startedAt;
        await this.log.logCall({
          modelConfigId: cfgEntity.id,
          model: cfg.model,
          prompt: opts.goal,
          response: '',
          durationMs: duration,
          status: 0,
          error: e?.message || String(e),
        });
        return { answer: '', steps, error: e?.message || String(e) };
      }
    }

    return { answer, steps };
  }
}
