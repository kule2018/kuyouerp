import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AiModelConfig,
  AiPromptTemplate,
  AiTool,
  AiKnowledge,
  AiCallLog,
  AiToolCallLog,
} from './ai.entities';
import { Goods } from '../../entities/kuyou_goods.entity';
import { Customers } from '../../entities/kuyou_customers.entity';
import { ModelConfigService } from './model-config.service';
import { PromptTemplateService } from './prompt-template.service';
import { ChatClientService } from './chat-client.service';
import { AiLogService } from './ai-log.service';
import { KeywordRetrievalService } from './keyword-retrieval.service';
import { AgentService } from './agent.service';
import { AnalysisService } from './analysis.service';
import { RecognitionService } from './recognition.service';
import { ToolCallbacks } from './tool-callbacks';
import { ErpToolsService } from './tools/erp-tools.service';
import { AiController } from './ai.controller';

/**
 * AI 模块装配
 * 注册 AI 全部实体 + 示例业务实体（供工具调用），并提供各子服务。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiModelConfig,
      AiPromptTemplate,
      AiTool,
      AiKnowledge,
      AiCallLog,
      AiToolCallLog,
      Goods,
      Customers,
    ]),
  ],
  controllers: [AiController],
  providers: [
    ModelConfigService,
    PromptTemplateService,
    ChatClientService,
    AiLogService,
    KeywordRetrievalService,
    AgentService,
    AnalysisService,
    RecognitionService,
    ToolCallbacks,
    ErpToolsService,
  ],
  exports: [ModelConfigService, PromptTemplateService, ChatClientService, ToolCallbacks],
})
export class AiModule {}
