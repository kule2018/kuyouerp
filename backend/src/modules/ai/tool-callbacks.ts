import { Injectable } from '@nestjs/common';
import { ToolDefinition, getToolMeta } from './tool.decorator';

/**
 * ToolCallbacks —— 等价 Spring AI 的 ToolCallbacks
 * 职责：
 *  1. 收集所有被 @Tool 装饰的方法（register 扫描实例）
 *  2. 生成可供大模型使用的 function 定义列表（getDefinitions）
 *  3. 按工具名执行工具并回传字符串结果（call）
 * 这是 Function Calling 工具调用的统一入口。
 */
@Injectable()
export class ToolCallbacks {
  /** name -> { 实例, 元数据, 方法名 } */
  private readonly toolMap = new Map<
    string,
    { instance: any; meta: ToolDefinition; method: string }
  >();

  /** 注册一个工具实例（扫描其 @Tool 方法） */
  register(instance: any): void {
    const ctor = instance?.constructor;
    const list: { meta: ToolDefinition; method: string }[] = ctor?.__aiTools || [];
    for (const t of list) {
      this.toolMap.set(t.meta.name, { instance, meta: t.meta, method: t.method });
    }
  }

  /** 批量注册 */
  registerAll(instances: any[]): void {
    for (const i of instances) this.register(i);
  }

  /** 是否存在某工具 */
  has(name: string): boolean {
    return this.toolMap.has(name);
  }

  /** 生成 OpenAI function 定义列表 */
  getDefinitions(): any[] {
    return Array.from(this.toolMap.values()).map((t) => ({
      type: 'function',
      function: {
        name: t.meta.name,
        description: t.meta.description,
        parameters: t.meta.parameters || { type: 'object', properties: {} },
      },
    }));
  }

  /** 按名执行工具，返回字符串结果（供大模型回写） */
  async call(name: string, args: Record<string, any>): Promise<string> {
    const t = this.toolMap.get(name);
    if (!t) {
      return JSON.stringify({ error: `未注册的工具: ${name}` });
    }
    try {
      const fn = t.instance[t.method].bind(t.instance);
      const result = await fn(args || {});
      return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (e: any) {
      return JSON.stringify({ error: e?.message || String(e) });
    }
  }
}
