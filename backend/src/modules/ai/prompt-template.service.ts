import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiPromptTemplate } from './ai.entities';

/** Prompt 模板服务（Prompt模板管理 + 变量渲染） */
@Injectable()
export class PromptTemplateService {
  constructor(
    @InjectRepository(AiPromptTemplate)
    private readonly repo: Repository<AiPromptTemplate>,
  ) {}

  findAll() {
    return this.repo.find({ order: { id: 'DESC' } });
  }

  findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  findByCode(code: string) {
    return this.repo.findOne({ where: { code } });
  }

  create(data: Partial<AiPromptTemplate>) {
    const e = this.repo.create({ ...data, createtime: Date.now(), updatetime: Date.now() } as any);
    return this.repo.save(e);
  }

  async update(id: number, data: Partial<AiPromptTemplate>) {
    await this.repo.update(id, { ...data, updatetime: Date.now() } as any);
    return this.findOne(id);
  }

  remove(id: number) {
    return this.repo.delete(id);
  }

  /**
   * 渲染模板：将 {{var}} 替换为变量值
   * @param content 模板内容
   * @param vars    变量键值
   */
  render(content: string, vars: Record<string, any> = {}): string {
    if (!content) return '';
    return content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
      const v = vars?.[key];
      return v === undefined || v === null ? '' : String(v);
    });
  }
}
