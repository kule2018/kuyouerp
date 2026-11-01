import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_user_ordersaleinfo
 */
@Entity('kuyou_user_ordersaleinfo')
export class UserOrdersaleinfo {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 销货单ID */
  @Column({ name: 'sales_id', type: 'int', nullable: true, comment: '销货单ID' })
  salesId: number;

  /** 订单详情ID */
  @Column({ name: 'orderinfo_id', type: 'int', nullable: true, comment: '订单详情ID' })
  orderinfoId: number;

  /** 销货单详情ID */
  @Column({ name: 'salesinfo_id', type: 'int', nullable: false, default: '0', comment: '销货单详情ID' })
  salesinfoId: number;
}
