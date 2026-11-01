import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_excpur_info
 */
@Entity('kuyou_goods_excpur_info')
export class GoodsExcpurInfo {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'exchange_id', type: 'int', nullable: true, default: '0' })
  exchangeId: number;

  @Column({ name: 'purchase_id', type: 'int', nullable: true })
  purchaseId: number;

  /** 类型:1=购货订单,2=购货单 */
  @Column({ name: 'type', type: 'varchar', length: 255, nullable: true, comment: '类型:1=购货订单,2=购货单' })
  type: string;

  @Column({ name: 'number', type: 'float', nullable: true, default: '0.00' })
  number: number;

  /** 退款金额 */
  @Column({ name: 'money', type: 'float', nullable: true, default: '0.00', comment: '退款金额' })
  money: number;

  /** 购货金额 */
  @Column({ name: 'all_money', type: 'double', nullable: true, default: '0.0000', comment: '购货金额' })
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

  /** 是否审核 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: true, default: '0', comment: '是否审核' })
  status: string;

  @Column({ name: 'times', type: 'int', nullable: true })
  times: number;
}
