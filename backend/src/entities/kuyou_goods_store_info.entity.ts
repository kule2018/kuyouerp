import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_store_info
 */
@Entity('kuyou_goods_store_info')
export class GoodsStoreInfo {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int', nullable: true, default: '0' })
  orderId: number;

  @Column({ name: 'purchase_id', type: 'int', nullable: true })
  purchaseId: number;

  @Column({ name: 'number', type: 'double', nullable: true, default: '0.0000' })
  number: number;

  @Column({ name: 'money', type: 'double', nullable: true, default: '0.0000' })
  money: number;

  @Column({ name: 'all_money', type: 'double', nullable: true, default: '0.0000' })
  allMoney: number;

  @Column({ name: 'createtime', type: 'bigint', nullable: true })
  createtime: number;
}
