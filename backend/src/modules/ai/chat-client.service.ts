import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

/**
 * ChatClient —— 等价 Spring AI 的 ChatClient
 * 封装 OpenAI 兼容对话接口，支持：
 *  - 系统提示（来自 Prompt 模板）
 *  - Function Calling（tools / tool_choice）
 *  - 结构化 JSON 输出（response_format = json_object / json_schema）
 */
export interface ChatClientConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** 文本，或视觉模型所需的 content 数组（图文混排） */
  content: string | null | any;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  tools?: any[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  /** 结构化输出：'text' | 'json' | 'json_schema' */
  responseFormat?: 'text' | 'json' | 'json_schema';
  jsonSchema?: Record<string, any>;
}

export interface ChatResult {
  content: string;
  toolCalls: any[];
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

@Injectable()
export class ChatClientService {
  /**
   * 发起一次对话
   * 每次按配置创建独立 client（支持多模型/多供应商并存）
   */
  async chat(config: ChatClientConfig, options: ChatOptions): Promise<ChatResult> {
    const client = new OpenAI({
      apiKey: config.apiKey || 'sk-nokey',
      baseURL: config.baseUrl || 'https://api.openai.com/v1',
    });

    const body: any = {
      model: config.model,
      messages: options.messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 2048,
    };

    // Function Calling 工具
    if (options.tools && options.tools.length) {
      body.tools = options.tools;
      body.tool_choice = options.toolChoice || 'auto';
    }

    // 结构化 JSON 输出
    if (options.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    } else if (options.responseFormat === 'json_schema' && options.jsonSchema) {
      body.response_format = {
        type: 'json_schema',
        json_schema: { name: 'result', strict: false, schema: options.jsonSchema },
      };
    }

    const resp = await client.chat.completions.create(body);
    const msg = resp.choices?.[0]?.message;
    return {
      content: msg?.content || '',
      toolCalls: msg?.tool_calls || [],
      usage: resp.usage || {},
    };
  }
}
