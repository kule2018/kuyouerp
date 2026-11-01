import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_user_history
 */
@Entity('kuyou_user_history')
export class UserHistory {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 用户ID */
  @Column({ name: 'user_id', type: 'int', nullable: true, comment: '用户ID' })
  userId: number;

  /** 商品ID */
  @Column({ name: 'goods_id', type: 'int', nullable: false, default: '0', comment: '商品ID' })
  goodsId: number;

  /** 商品单位 */
  @Column({ name: 'goods_unit', type: 'int', nullable: true, comment: '商品单位' })
  goodsUnit: number;

  /** 商品属性 */
  @Column({ name: 'goods_attr', type: 'int', nullable: true, comment: '商品属性' })
  goodsAttr: number;

  /** 日期 */
  @Column({ name: 'look_date', type: 'varchar', length: 50, nullable: true, comment: '日期' })
  lookDate: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
