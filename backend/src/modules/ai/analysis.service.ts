import { Injectable } from '@nestjs/common';
import { ChatClientService, ChatMessage } from './chat-client.service';
import { ModelConfigService } from './model-config.service';
import { ErpToolsService } from './tools/erp-tools.service';

export type AnalysisKind =
  | 'inventory'
  | 'purchase'
  | 'sales'
  | 'receivable'
  | 'overstock'
  | 'overview';

/**
 * 智能经营分析服务
 * 先并行跑对应的 ERP 分析工具（库存预警 / 补货建议 / 销售排行 / 应收 / 呆滞），
 * 再把结构化数据交给大模型，产出中文洞察报告（核心结论 + 数据要点 + 行动建议）。
 */
@Injectable()
export class AnalysisService {
  constructor(
    private readonly chat: ChatClientService,
    private readonly modelConfig: ModelConfigService,
    private readonly tools: ErpToolsService,
  ) {}

  async analyze(kind: AnalysisKind, modelConfigId?: number) {
    const cfgEntity = modelConfigId
      ? await this.modelConfig.findOne(modelConfigId)
      : await this.modelConfig.findDefault();
    if (!cfgEntity) return { report: '', error: '未配置可用的模型' };
    const cfg = this.modelConfig.toClientConfig(cfgEntity);

    // 1) 并行采集对应维度的业务数据
    const data: Record<string, any> = {};
    if (kind === 'inventory' || kind === 'overview') data.inventoryWarning = await this.tools.inventoryWarning({});
    if (kind === 'purchase' || kind === 'overview') data.purchaseSuggestion = await this.tools.purchaseSuggestion({});
    if (kind === 'sales' || kind === 'overview') data.salesRanking = await this.tools.salesRanking({});
    if (kind === 'receivable' || kind === 'overview') data.receivableAnalysis = await this.tools.receivableAnalysis({});
    if (kind === 'overstock' || kind === 'overview') data.overstockAnalysis = await this.tools.overstockAnalysis({});

    // 2) 交给大模型生成中文洞察
    const system =
      '你是资深 ERP 经营分析师。请根据提供的业务数据，用简体中文给出结构化洞察与可执行建议。' +
      '使用 Markdown，分「核心结论」「数据要点」「行动建议」三段。只基于给定数据作答，不要编造数据中不存在的内容。';
    const user = `分析维度：${this.kindLabel(kind)}\n\n业务数据（JSON）：\n${JSON.stringify(data, null, 2)}`;
    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];
    try {
      const r = await this.chat.chat(cfg, { messages, responseFormat: 'text' });
      return { report: r.content, data, kind };
    } catch (e: any) {
      return { report: '', data, kind, error: e?.message || String(e) };
    }
  }

  private kindLabel(k: AnalysisKind): string {
    return (
      {
        inventory: '库存预警',
        purchase: '智能补货',
        sales: '销售分析',
        receivable: '应收分析',
        overstock: '呆滞库存',
        overview: '综合经营概览',
      }[k] || k
    );
  }
}
