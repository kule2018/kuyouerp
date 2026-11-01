import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiCallLog, AiToolCallLog } from './ai.entities';

/**
 * AI 调用与工具调用日志服务
 * 记录每一次大模型调用与工具调用的入参/出参/耗时/状态，便于审计与复盘。
 */
@Injectable()
export class AiLogService {
  constructor(
    @InjectRepository(AiCallLog)
    private readonly callRepo: Repository<AiCallLog>,
    @InjectRepository(AiToolCallLog)
    private readonly toolRepo: Repository<AiToolCallLog>,
  ) {}

  /** 记录一次 AI 调用（返回日志实体，供工具调用日志关联） */
  async logCall(partial: Partial<AiCallLog>) {
    const e = this.callRepo.create({
      ...partial,
      createtime: Date.now(),
    } as any);
    return this.callRepo.save(e);
  }

  /** 更新调用日志（补充响应/状态/耗时） */
  updateCall(id: number, partial: Partial<AiCallLog>) {
    return this.callRepo.update(id, partial as any);
  }

  /** 记录一次工具调用 */
  logToolCall(partial: Partial<AiToolCallLog>) {
    const e = this.toolRepo.create({
      ...partial,
      createtime: Date.now(),
    } as any);
    return this.toolRepo.save(e);
  }

  findCalls(limit = 50) {
    return this.callRepo.find({ order: { id: 'DESC' }, take: limit });
  }

  findToolCalls(callLogId?: number, limit = 100) {
    const where = callLogId ? { callLogId } : {};
    return this.toolRepo.find({ where, order: { id: 'DESC' }, take: limit });
  }
}
