import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiKnowledge } from './ai.entities';

/**
 * 关键词检索服务
 * 对知识库做轻量级关键词命中评分（标题/关键词权重更高），返回 topK 片段，
 * 作为大模型回答的上下文（RAG 的关键词召回环节）。
 */
@Injectable()
export class KeywordRetrievalService {
  constructor(
    @InjectRepository(AiKnowledge)
    private readonly repo: Repository<AiKnowledge>,
  ) {}

  /** 简单分词：按空白与标点切分，并保留原始查询串用于整体子串匹配 */
  private tokenize(query: string): string[] {
    const cleaned = query.replace(/[\s,，。、；;:：!！?？]+/g, ' ').trim();
    const tokens = cleaned.split(' ').filter((t) => t.length > 0);
    return tokens;
  }

  /** 单条知识命中评分 */
  private score(k: AiKnowledge, tokens: string[], raw: string): number {
    let s = 0;
    const title = (k.title || '').toLowerCase();
    const content = (k.content || '').toLowerCase();
    const keywords = (k.keywords || '').toLowerCase();
    for (const t of tokens) {
      const tt = t.toLowerCase();
      if (title.includes(tt)) s += 3;
      if (keywords.includes(tt)) s += 4;
      if (content.includes(tt)) s += 1;
    }
    // 整体子串加分
    if ((title + content).toLowerCase().includes(raw.toLowerCase())) s += 2;
    return s;
  }

  /* ---------------- 知识库 CRUD（供控制器调用） ---------------- */
  findKnowledge() {
    return this.repo.find({ order: { id: 'DESC' } });
  }
  saveKnowledge(data: Partial<AiKnowledge>) {
    const e = this.repo.create({ ...data, createtime: Date.now(), updatetime: Date.now() } as any);
    return this.repo.save(e);
  }
  updateKnowledge(id: number, data: Partial<AiKnowledge>) {
    return this.repo.update(id, { ...data, updatetime: Date.now() } as any);
  }
  deleteKnowledge(id: number) {
    return this.repo.delete(id);
  }

  /**
   * 检索
   * @param query 查询词
   * @param topK  返回条数
   */
  async retrieve(query: string, topK = 5): Promise<Array<AiKnowledge & { score: number }>> {
    if (!query) return [];
    const all = await this.repo.find();
    const tokens = this.tokenize(query);
    const raw = query.trim();
    const scored = all
      .map((k) => ({ ...k, score: this.score(k, tokens, raw) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return scored;
  }
}
