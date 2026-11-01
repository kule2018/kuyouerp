import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_unit
 */
@Entity('kuyou_unit')
export class Unit {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 单位名称 */
  @Column({ name: 'name', type: 'varchar', length: 100, nullable: true, comment: '单位名称' })
  name: string;

  /** 类型:1=单一单位,2=多单位 */
  @Column({ name: 'type', type: 'varchar', length: 255, nullable: true, default: '1', comment: '类型:1=单一单位,2=多单位' })
  type: string;

  /** 是否主单位:0=否,1=是 */
  @Column({ name: 'is_main', type: 'varchar', length: 255, nullable: true, default: '0', comment: '是否主单位:0=否,1=是' })
  isMain: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
