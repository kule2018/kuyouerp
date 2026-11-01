import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_attribute
 */
@Entity('kuyou_attribute')
export class Attribute {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 属性名称 */
  @Column({ name: 'name', type: 'varchar', length: 100, nullable: true, comment: '属性名称' })
  name: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
