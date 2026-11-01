import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_user_ordersale
 */
@Entity('kuyou_user_ordersale')
export class UserOrdersale {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 订单ID */
  @Column({ name: 'order_id', type: 'int', nullable: true, comment: '订单ID' })
  orderId: number;

  /** 销货单ID */
  @Column({ name: 'sales_id', type: 'int', nullable: false, default: '0', comment: '销货单ID' })
  salesId: number;
}
