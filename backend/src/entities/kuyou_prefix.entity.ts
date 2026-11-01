import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_prefix
 */
@Entity('kuyou_prefix')
export class Prefix {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 单据类型 */
  @Column({ name: 'type', type: 'tinyint', nullable: false, default: '1', comment: '单据类型' })
  type: number;

  /** 单据 */
  @Column({ name: 'name', type: 'varchar', length: 255, nullable: false, default: '', comment: '单据' })
  name: string;

  /** 前缀 */
  @Column({ name: 'prefix', type: 'varchar', length: 10, nullable: false, default: '', comment: '前缀' })
  prefix: string;

  /** 年 */
  @Column({ name: 'year', type: 'varchar', length: 255, nullable: false, default: '1', comment: '年' })
  year: string;

  /** 月 */
  @Column({ name: 'month', type: 'varchar', length: 255, nullable: false, default: '1', comment: '月' })
  month: string;

  /** 日 */
  @Column({ name: 'day', type: 'varchar', length: 255, nullable: false, default: '1', comment: '日' })
  day: string;

  /** 时 */
  @Column({ name: 'hour', type: 'varchar', length: 255, nullable: false, default: '1', comment: '时' })
  hour: string;

  /** 分 */
  @Column({ name: 'minute', type: 'varchar', length: 255, nullable: false, default: '1', comment: '分' })
  minute: string;

  /** 秒 */
  @Column({ name: 'second', type: 'varchar', length: 255, nullable: false, default: '1', comment: '秒' })
  second: string;

  /** 起始数 */
  @Column({ name: 'start', type: 'int', nullable: true, comment: '起始数' })
  start: number;

  /** 自定义数字长度 */
  @Column({ name: 'strlen', type: 'int', nullable: true, default: '0', comment: '自定义数字长度' })
  strlen: number;

  /** 示例 */
  @Column({ name: 'example', type: 'varchar', length: 50, nullable: true, comment: '示例' })
  example: string;

  /** 表 */
  @Column({ name: 'dbname', type: 'varchar', length: 50, nullable: true, comment: '表' })
  dbname: string;

  /** 字段名 */
  @Column({ name: 'field', type: 'varchar', length: 50, nullable: true, comment: '字段名' })
  field: string;
}
