import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ok } from '../../common/utils/resp';
import { ModelConfigService } from './model-config.service';
import { PromptTemplateService } from './prompt-template.service';
import { ChatClientService, ChatMessage } from './chat-client.service';
import { AgentService } from './agent.service';
import { KeywordRetrievalService } from './keyword-retrieval.service';
import { AiLogService } from './ai-log.service';
import { AnalysisService } from './analysis.service';
import { RecognitionService } from './recognition.service';
import { ToolCallbacks } from './tool-callbacks';

/**
 * AI 模块接口
 * 路由前缀：全局 kuyou + 本控制器 ai → /kuyou/ai/*
 * 全部需要登录（JwtAuthGuard）。
 */
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly modelConfig: ModelConfigService,
    private readonly promptTemplate: PromptTemplateService,
    private readonly chatClient: ChatClientService,
    private readonly agent: AgentService,
    private readonly retrieval: KeywordRetrievalService,
    private readonly log: AiLogService,
    private readonly tools: ToolCallbacks,
    private readonly analysis: AnalysisService,
    private readonly recognition: RecognitionService,
  ) {}

  /** 一次性对话（支持系统提示/工具/结构化JSON） POST /kuyou/ai/chat */
  @Post('chat')
  async chat(@Body() body: any) {
    const cfgEntity = body.modelConfigId
      ? await this.modelConfig.findOne(body.modelConfigId)
      : await this.modelConfig.findDefault();
    if (!cfgEntity) return ok(null, '未配置可用模型');

    const messages: ChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
    // 模板渲染系统提示
    if (body.templateCode) {
      const tpl = await this.promptTemplate.findByCode(body.templateCode);
      if (tpl) {
        const system = this.promptTemplate.render(tpl.content, body.templateVars || {});
        messages.unshift({ role: 'system', content: system });
      }
    } else if (body.system) {
      messages.unshift({ role: 'system', content: body.system });
    }

    const defs = body.useTools ? this.tools.getDefinitions() : [];
    const result = await this.chatClient.chat(this.modelConfig.toClientConfig(cfgEntity), {
      messages,
      tools: defs,
      responseFormat: body.responseFormat,
      jsonSchema: body.jsonSchema,
    });
    return ok(result);
  }

  /** Agent 多轮自主执行 POST /kuyou/ai/agent */
  @Post('agent')
  async runAgent(@Body() body: any) {
    let systemPrompt: string | undefined;
    if (body.templateCode) {
      const tpl = await this.promptTemplate.findByCode(body.templateCode);
      if (tpl) systemPrompt = this.promptTemplate.render(tpl.content, body.templateVars || {});
    }
    const result = await this.agent.run({
      goal: body.goal,
      modelConfigId: body.modelConfigId,
      systemPrompt,
      useTools: body.useTools,
      maxTurns: body.maxTurns,
      responseFormat: body.responseFormat,
      jsonSchema: body.jsonSchema,
    });
    return ok(result);
  }

  /** 关键词检索 POST /kuyou/ai/retrieve */
  @Post('retrieve')
  async retrieve(@Body() body: { query?: string; topK?: number }) {
    const list = await this.retrieval.retrieve(body.query || '', body.topK || 5);
    return ok(list);
  }

  /** 智能经营分析 POST /kuyou/ai/analyze —— 汇总多维度数据并由大模型产出中文洞察 */
  @Post('analyze')
  async analyze(@Body() body: { kind?: string; modelConfigId?: number }) {
    const kind = (body.kind || 'overview') as any;
    const result = await this.analysis.analyze(kind, body.modelConfigId);
    return ok(result);
  }

  /** 单据/文档智能识别 POST /kuyou/ai/recognize —— 文本或图片抽取为结构化字段 */
  @Post('recognize')
  async recognize(
    @Body()
    body: {
      docType: string;
      text?: string;
      imageBase64?: string;
      imageMime?: string;
      modelConfigId?: number;
    },
  ) {
    if (!body.docType) return ok(null, '缺少 docType');
    const result = await this.recognition.recognize(body);
    return ok(result);
  }

  /** 已注册工具清单 GET /kuyou/ai/tools */
  @Get('tools')
  listTools() {
    return ok(this.tools.getDefinitions());
  }

  /* ---------------- 模型配置 CRUD ---------------- */
  @Get('model-config') listModels() { return ok(this.modelConfig.findAll()); }
  @Post('model-config') createModel(@Body() body: any) { return ok(this.modelConfig.create(body)); }
  @Put('model-config/:id') updateModel(@Param('id') id: number, @Body() body: any) {
    return ok(this.modelConfig.update(id, body));
  }
  @Delete('model-config/:id') deleteModel(@Param('id') id: number) {
    return ok(this.modelConfig.remove(id));
  }

  /* ---------------- Prompt 模板 CRUD ---------------- */
  @Get('prompt-template') listTemplates() { return ok(this.promptTemplate.findAll()); }
  @Post('prompt-template') createTemplate(@Body() body: any) { return ok(this.promptTemplate.create(body)); }
  @Put('prompt-template/:id') updateTemplate(@Param('id') id: number, @Body() body: any) {
    return ok(this.promptTemplate.update(id, body));
  }
  @Delete('prompt-template/:id') deleteTemplate(@Param('id') id: number) {
    return ok(this.promptTemplate.remove(id));
  }

  /* ---------------- 知识库 CRUD ---------------- */
  @Get('knowledge') listKnowledge() {
    return ok(this.retrieval.findKnowledge());
  }
  @Post('knowledge') createKnowledge(@Body() body: any) {
    return ok(this.retrieval.saveKnowledge(body));
  }
  @Put('knowledge/:id') updateKnowledge(@Param('id') id: number, @Body() body: any) {
    return ok(this.retrieval.updateKnowledge(id, body));
  }
  @Delete('knowledge/:id') deleteKnowledge(@Param('id') id: number) {
    return ok(this.retrieval.deleteKnowledge(id));
  }

  /* ---------------- 日志 ---------------- */
  @Get('call-logs') callLogs(@Query('limit') limit = 50) {
    return ok(this.log.findCalls(Number(limit) || 50));
  }
  @Get('tool-logs') toolLogs(@Query('callLogId') callLogId?: number) {
    return ok(this.log.findToolCalls(callLogId ? Number(callLogId) : undefined));
  }
}
