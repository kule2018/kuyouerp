import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_exchangethird
 */
@Entity('kuyou_goods_exchangethird')
export class GoodsExchangethird {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 外部订单号 */
  @Column({ name: 'order_num', type: 'varchar', length: 100, nullable: true, default: '0', comment: '外部订单号' })
  orderNum: string;

  /** 销货单ID */
  @Column({ name: 'purchase_id', type: 'int', nullable: true, comment: '销货单ID' })
  purchaseId: number;

  /** 三方ID */
  @Column({ name: 'third_id', type: 'int', nullable: true, comment: '三方ID' })
  thirdId: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
