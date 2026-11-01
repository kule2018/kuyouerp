import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 表 kuyou_checkout —— 由 install.sql 自动生成（一比一还原字段）
 * 对应原 kuyou 表：kuyou_checkout
 */
@Entity('kuyou_checkout')
export class Checkout {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 结账日期 */
  @Column({ name: 'checkdate', type: 'varchar', length: 50, nullable: true, comment: '结账日期' })
  checkdate: string;

  /** 结账日期 */
  @Column({ name: 'checktime', type: 'bigint', nullable: true, comment: '结账日期' })
  checktime: number;

  /** 操作人 */
  @Column({ name: 'preparation_id', type: 'int', nullable: true, comment: '操作人' })
  preparationId: number;

  /** 操作日期 */
  @Column({ name: 'preparation_time', type: 'bigint', nullable: true, comment: '操作日期' })
  preparationTime: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
