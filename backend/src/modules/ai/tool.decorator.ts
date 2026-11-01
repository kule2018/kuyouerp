/**
 * @Tool 装饰器 —— 等价 Spring AI 的 @Tool
 * 标记在某个 Service 方法上，声明该方法是一个可被大模型调用的工具(Function Calling)。
 * 配合 ToolCallbacks 自动收集工具元数据，并生成 OpenAI function 定义。
 *
 * 用法：
 *   @Tool({ name: 'get_goods', description: '按条件查询商品', parameters: {...jsonSchema} })
 *   async getGoods(args: { keyword?: string }) { ... return '结果'; }
 */
export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema 参数定义（OpenAI function.parameters） */
  parameters: Record<string, any>;
}

const TOOL_META_KEY = '__ai_tool_meta__';

export function Tool(meta: ToolDefinition) {
  return function (
    target: any,
    propertyKey: string,
    _descriptor: PropertyDescriptor,
  ) {
    Reflect.defineMetadata(TOOL_META_KEY, meta, target, propertyKey);
    // 在构造函数上登记，便于 ToolCallbacks 扫描
    if (!target.constructor.__aiTools) {
      target.constructor.__aiTools = [];
    }
    target.constructor.__aiTools.push({ meta, method: propertyKey });
  };
}

/** 读取方法上的工具元数据 */
export function getToolMeta(target: any, propertyKey: string): ToolDefinition | undefined {
  return Reflect.getMetadata(TOOL_META_KEY, target, propertyKey);
}
