import { Injectable } from '@nestjs/common';
import { ChatClientService, ChatMessage } from './chat-client.service';
import { ModelConfigService } from './model-config.service';

/**
 * 单据/文档智能识别服务
 * 将粘贴的单据文本或上传的图片（base64）交给大模型，抽取为结构化字段，
 * 返回可直接回填表单的 JSON。图片走多模态（视觉模型）识别。
 */
@Injectable()
export class RecognitionService {
  constructor(
    private readonly chat: ChatClientService,
    private readonly modelConfig: ModelConfigService,
  ) {}

  async recognize(payload: {
    docType: string;
    text?: string;
    imageBase64?: string;
    imageMime?: string;
    modelConfigId?: number;
  }) {
    const cfgEntity = payload.modelConfigId
      ? await this.modelConfig.findOne(payload.modelConfigId)
      : await this.modelConfig.findDefault();
    if (!cfgEntity) return { fields: null, error: '未配置可用的模型' };
    const cfg = this.modelConfig.toClientConfig(cfgEntity);

    const docGuide = this.docGuide(payload.docType);
    const system =
      '你是 ERP 单据识别专家。请将用户提供的单据内容（文本或图片）抽取为结构化字段，仅输出 JSON，' +
      '字段名用 snake_case 英文；金额/数量/日期尽量保留原始数值与单位；明细类用数组。不要输出多余解释。' +
      docGuide;
    const userText = payload.text
      ? `以下是单据文本：\n${payload.text}`
      : '请识别下面这张图片中的单据并抽取字段。';

    const content: any[] = [{ type: 'text', text: userText }];
    if (payload.imageBase64) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${payload.imageMime || 'image/jpeg'};base64,${payload.imageBase64}` },
      });
    }
    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content },
    ];

    try {
      const r = await this.chat.chat(cfg, { messages, responseFormat: 'json' });
      let fields: any = null;
      try {
        fields = JSON.parse(r.content);
      } catch {
        const m = r.content.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            fields = JSON.parse(m[0]);
          } catch {
            /* ignore */
          }
        }
      }
      return { fields, raw: r.content, docType: payload.docType };
    } catch (e: any) {
      return { fields: null, error: e?.message || String(e) };
    }
  }

  /** 不同单据类型的字段指引，帮助模型产出一致的字段结构 */
  private docGuide(docType: string): string {
    const map: Record<string, string> = {
      purchase:
        '目标单据：采购单/购货单。典型字段：suppliers_name(供应商), goods_list(商品明细数组，含 goods_name/number/price/unit), amount(总金额), order_time(单据日期), remark。',
      sales:
        '目标单据：销售单/销货单。典型字段：customers_name(客户), goods_list(商品明细), amount, order_time, remark。',
      invoice:
        '目标单据：发票。典型字段：invoice_code, invoice_no, seller, buyer, amount, tax, invoice_time。',
      receipt:
        '目标单据：收据/收付款单。典型字段：party(往来单位), money(金额), type(收/付款), time, remark。',
    };
    return map[docType] || `目标单据类型：${docType}。请尽量抽取关键字段（编号、往来单位、商品明细、数量、单价、金额、日期、备注等）。`;
  }
}
