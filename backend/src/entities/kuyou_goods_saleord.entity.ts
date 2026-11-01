import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_saleord
 */
@Entity('kuyou_goods_saleord')
export class GoodsSaleord {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int', nullable: true, default: '0' })
  orderId: number;

  @Column({ name: 'purchase_id', type: 'int', nullable: true })
  purchaseId: number;
}
