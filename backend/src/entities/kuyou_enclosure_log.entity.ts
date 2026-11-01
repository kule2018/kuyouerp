import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_enclosure_log
 */
@Entity('kuyou_enclosure_log')
export class EnclosureLog {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 附件ID */
  @Column({ name: 'enclosure_id', type: 'int', nullable: false, default: '0', comment: '附件ID' })
  enclosureId: number;

  /** 单据ID */
  @Column({ name: 'order_id', type: 'int', nullable: true, default: '0', comment: '单据ID' })
  orderId: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: true, comment: '单据编号' })
  purchaseCode: string;

  /** 单据类型:1=购货订单,2:购货单,3:购货退货单,4:销货订单,5:销货单,6:销货退货单 */
  @Column({ name: 'type', type: 'varchar', length: 255, nullable: true, comment: '单据类型:1=购货订单,2:购货单,3:购货退货单,4:销货订单,5:销货单,6:销货退货单' })
  type: string;
}
