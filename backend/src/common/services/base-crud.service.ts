import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository, Brackets, SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { PaginateDto } from '../dto/paginate.dto';
import { table } from '../utils/resp';

/**
 * FastAdmin 风格的通用 CRUD 服务
 * 目标：让每个业务模块以极少代码获得与原 kuyou 完全一致的接口行为
 * （index 列表 / selectpage 下拉 / add / edit / del），返回结构对齐 layui。
 *
 * 支持：
 *  - buildparams 过滤：filter(JSON) + op(JSON)，操作符 = != > >= < <= LIKE NOT LIKE IN NOT IN BETWEEN FIND_IN_SET NULL NOT NULL
 *  - 快速搜索 search（走 searchFields 模糊匹配）
 *  - 排序 sort/order
 *  - 分页 offset/limit
 *  - 关联查询 relations
 *  - 软删除（默认字段 deletetime，存在则置时间戳，否则硬删除）
 *  - 自动维护 createtime / updatetime（列存在时）
 */
export interface PaginateOptions {
  /** 快速搜索命中的字段 */
  searchFields?: string[];
  /** 默认排序字段 */
  defaultSort?: string;
  /** 默认排序方向 */
  defaultOrder?: 'ASC' | 'DESC';
  /** 关联实体（leftJoinAndSelect） */
  relations?: string[];
  /** 软删除字段名，留空表示硬删除 */
  deleteField?: string;
}

@Injectable()
export class BaseCrudService<E extends ObjectLiteral> {
  protected readonly alias = 'e';

  constructor(protected readonly repo: Repository<E>) {}

  /** 列是否存在于实体元数据 */
  private hasColumn(name: string): boolean {
    return this.repo.metadata.columns.some((c) => c.propertyName === name);
  }

  /**
   * 字段名解析：兼容 DB 列名（如 goods_name）与实体属性名（如 goodsName）
   * FastAdmin 约定 filter/sort 使用列名，而 TypeORM 查询构造器按属性名解析，
   * 这里统一把列名翻译回属性名，保证两种写法都能正确生成 SQL。
   */
  private resolveField(field: string): string {
    const col = this.repo.metadata.columns.find(
      (c) => c.propertyName === field || (c as any).name === field || c.databaseName === field,
    );
    return col ? col.propertyName : field;
  }

  /** 解析 FastAdmin filter/op 为查询条件 */
  private applyFilter(
    qb: SelectQueryBuilder<E>,
    filter?: string,
    op?: string,
    search?: string,
    searchFields: string[] = [],
  ) {
    // 1) 关键字快速搜索
    if (search && searchFields.length) {
      qb.andWhere(
        new Brackets((w) => {
          searchFields.forEach((f, i) => {
            const p = `kw_${i}`;
            if (i === 0) w.where(`e.${this.resolveField(f)} LIKE :${p}`, { [p]: `%${search}%` });
            else w.orWhere(`e.${this.resolveField(f)} LIKE :${p}`, { [p]: `%${search}%` });
          });
        }),
      );
    }

    // 2) filter + op 精确/模糊条件
    if (filter) {
      let cond: Record<string, any> = {};
      try {
        cond = JSON.parse(filter);
      } catch {
        cond = {};
      }
      let ops: Record<string, string> = {};
      if (op) {
        try {
          ops = JSON.parse(op);
        } catch {
          ops = {};
        }
      }
      let idx = 0;
      for (const field of Object.keys(cond)) {
        const value = cond[field];
        const operator = (ops[field] || '=').toUpperCase();
        const p = `f_${idx++}`;
        const col = `${this.alias}.${this.resolveField(field)}`;
        switch (operator) {
          case '=':
            qb.andWhere(`${col} = :${p}`, { [p]: value });
            break;
          case '!=':
            qb.andWhere(`${col} != :${p}`, { [p]: value });
            break;
          case '>':
            qb.andWhere(`${col} > :${p}`, { [p]: value });
            break;
          case '>=':
            qb.andWhere(`${col} >= :${p}`, { [p]: value });
            break;
          case '<':
            qb.andWhere(`${col} < :${p}`, { [p]: value });
            break;
          case '<=':
            qb.andWhere(`${col} <= :${p}`, { [p]: value });
            break;
          case 'LIKE':
          case 'LIKE %...%':
            qb.andWhere(`${col} LIKE :${p}`, { [p]: `%${value}%` });
            break;
          case 'NOT LIKE':
            qb.andWhere(`${col} NOT LIKE :${p}`, { [p]: `%${value}%` });
            break;
          case 'IN':
            qb.andWhere(`${col} IN (:...${p})`, { [p]: String(value).split(',') });
            break;
          case 'NOT IN':
            qb.andWhere(`${col} NOT IN (:...${p})`, { [p]: String(value).split(',') });
            break;
          case 'BETWEEN': {
            const [a, b] = String(value).split(',');
            qb.andWhere(`${col} BETWEEN :${p}_a AND :${p}_b`, {
              [`${p}_a`]: a,
              [`${p}_b`]: b,
            });
            break;
          }
          case 'NOT BETWEEN': {
            const [a, b] = String(value).split(',');
            qb.andWhere(
              `(${col} NOT BETWEEN :${p}_a AND :${p}_b OR ${col} IS NULL)`,
              { [`${p}_a`]: a, [`${p}_b`]: b },
            );
            break;
          }
          case 'FIND_IN_SET':
            qb.andWhere(`FIND_IN_SET(:${p}, ${col})`, { [p]: value });
            break;
          case 'NULL':
            qb.andWhere(`${col} IS NULL`);
            break;
          case 'NOT NULL':
            qb.andWhere(`${col} IS NOT NULL`);
            break;
          default:
            qb.andWhere(`${col} = :${p}`, { [p]: value });
        }
      }
    }
  }

  /** 列表查询（layui table 约定：{total, rows}） */
  async paginate(dto: PaginateDto, opts: PaginateOptions = {}) {
    const qb = this.repo.createQueryBuilder(this.alias);
    (opts.relations || []).forEach((r) => qb.leftJoinAndSelect(`${this.alias}.${r}`, r));
    if (opts.deleteField) {
      qb.andWhere(`${this.alias}.${opts.deleteField} IS NULL`);
    }
    this.applyFilter(qb, dto.filter, dto.op, dto.search, opts.searchFields);

    const sort = this.resolveField(dto.sort || opts.defaultSort || 'id');
    const order = (dto.order || opts.defaultOrder || 'DESC') as 'ASC' | 'DESC';
    qb.orderBy(`${this.alias}.${sort}`, order);

    const offset = Number(dto.offset) || 0;
    const limit = Number(dto.limit) || 10;
    qb.skip(offset).take(limit);

    const [rows, total] = await qb.getManyAndCount();
    return table(total, rows);
  }

  /** selectpage 下拉（FastAdmin selectpage 约定：{list, total}） */
  async selectPage(dto: PaginateDto, opts: PaginateOptions = {}) {
    const qb = this.repo.createQueryBuilder(this.alias);
    if (opts.deleteField) {
      qb.andWhere(`${this.alias}.${opts.deleteField} IS NULL`);
    }
    // 选中值回填
    if (dto.keyField && dto.keyValue !== undefined && dto.keyValue !== '') {
      qb.andWhere(`${this.alias}.${dto.keyField} = :kv`, { kv: dto.keyValue });
    }
    // 关键字搜索（默认走 showField 或 searchFields）
    const q = dto.q || dto.search;
    if (q) {
      const fields = dto.showField ? [dto.showField] : opts.searchFields || [];
      if (fields.length) {
        qb.andWhere(
          new Brackets((w) => {
            fields.forEach((f, i) => {
              const p = `sp_${i}`;
              if (i === 0) w.where(`${this.alias}.${this.resolveField(f)} LIKE :${p}`, { [p]: `%${q}%` });
              else w.orWhere(`${this.alias}.${this.resolveField(f)} LIKE :${p}`, { [p]: `%${q}%` });
            });
          }),
        );
      }
    }
    const offset = Number(dto.offset) || 0;
    const limit = Number(dto.limit) || 10;
    qb.skip(offset).take(limit);
    const [list, total] = await qb.getManyAndCount();
    return { list, total };
  }

  /** 新增 */
  async add(data: Partial<E>) {
    const entity = this.repo.create(data as any);
    if (this.hasColumn('createtime') && (entity as any).createtime == null) {
      (entity as any).createtime = Date.now();
    }
    if (this.hasColumn('updatetime')) {
      (entity as any).updatetime = Date.now();
    }
    const saved = await this.repo.save(entity);
    return saved;
  }

  /** 编辑（支持 ids 批量，逗号分隔） */
  async edit(idOrIds: number | string, data: Partial<E>) {
    const ids = String(idOrIds)
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n));
    if (this.hasColumn('updatetime')) {
      (data as any).updatetime = Date.now();
    }
    await this.repo.update(ids, data as any);
    return { ids };
  }

  /** 删除（软删除优先，否则硬删除） */
  async del(idOrIds: number | string, deleteField = 'deletetime') {
    const ids = String(idOrIds)
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n));
    if (this.hasColumn(deleteField)) {
      await this.repo.update(ids, { [deleteField]: Date.now() } as any);
    } else {
      await this.repo.delete(ids);
    }
    return { ids };
  }
}
