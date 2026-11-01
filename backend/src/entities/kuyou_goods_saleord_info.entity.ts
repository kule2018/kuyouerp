import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_saleord_info
 */
@Entity('kuyou_goods_saleord_info')
export class GoodsSaleordInfo {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int', nullable: true, default: '0' })
  orderId: number;

  /** 销货明细ID */
  @Column({ name: 'purchase_id', type: 'int', nullable: true, comment: '销货明细ID' })
  purchaseId: number;

  /** 数量 */
  @Column({ name: 'number', type: 'float', nullable: true, default: '0.00', comment: '数量' })
  number: number;

  /** 已收款金额 */
  @Column({ name: 'money', type: 'float', nullable: true, default: '0.00', comment: '已收款金额' })
  money: number;

  /** 销货金额 */
  @Column({ name: 'all_money', type: 'float', nullable: true, default: '0.00', comment: '销货金额' })
  allMoney: number;

  /** 税率 */
  @Column({ name: 'tax_rate', type: 'double', nullable: true, default: '0.0000', comment: '税率' })
  taxRate: number;

  /** 税额 */
  @Column({ name: 'tax_money', type: 'double', nullable: true, default: '0.0000', comment: '税额' })
  taxMoney: number;

  /** 价税合计 */
  @Column({ name: 'money_tax_price', type: 'double', nullable: true, default: '0.0000', comment: '价税合计' })
  moneyTaxPrice: number;

  @Column({ name: 'status', type: 'varchar', length: 255, nullable: true, default: '0' })
  status: string;

  @Column({ name: 'times', type: 'int', nullable: true })
  times: number;
}
