import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiModelConfig } from './ai.entities';

/** 模型配置服务（模型配置数据库化） */
@Injectable()
export class ModelConfigService {
  constructor(
    @InjectRepository(AiModelConfig)
    private readonly repo: Repository<AiModelConfig>,
  ) {}

  findAll() {
    return this.repo.find({ order: { id: 'DESC' } });
  }

  findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  /** 取第一个启用的配置（默认模型） */
  findDefault(): Promise<AiModelConfig | null> {
    return this.repo.findOne({ where: { enabled: 1 }, order: { id: 'ASC' } });
  }

  create(data: Partial<AiModelConfig>) {
    const e = this.repo.create({ ...data, createtime: Date.now(), updatetime: Date.now() } as any);
    return this.repo.save(e);
  }

  async update(id: number, data: Partial<AiModelConfig>) {
    await this.repo.update(id, { ...data, updatetime: Date.now() } as any);
    return this.findOne(id);
  }

  remove(id: number) {
    return this.repo.delete(id);
  }

  /** 转为 ChatClient 可用的配置对象 */
  toClientConfig(c: AiModelConfig) {
    return {
      baseUrl: c.baseUrl,
      apiKey: c.apiKey,
      model: c.model,
      temperature: c.temperature,
      maxTokens: c.maxTokens,
    };
  }
}
