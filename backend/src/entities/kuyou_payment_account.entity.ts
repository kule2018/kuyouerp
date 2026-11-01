import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_payment_account
 */
@Entity('kuyou_payment_account')
export class PaymentAccount {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 收款单ID */
  @Column({ name: 'collection_id', type: 'int', nullable: false, default: '0', comment: '收款单ID' })
  collectionId: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: false, default: '', comment: '单据编号' })
  purchaseCode: string;

  /** 单据时间 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '单据时间' })
  purchaseTime: number;

  /** 结算账户 */
  @Column({ name: 'accounts_id', type: 'int', nullable: false, default: '0', comment: '结算账户' })
  accountsId: number;

  /** 付款金额 */
  @Column({ name: 'money', type: 'double', nullable: false, default: '0.0000', comment: '付款金额' })
  money: number;

  /** 结算方式 */
  @Column({ name: 'settlementtype', type: 'int', nullable: false, default: '0', comment: '结算方式' })
  settlementtype: number;

  /** 结算号 */
  @Column({ name: 'number', type: 'varchar', length: 50, nullable: true, default: '', comment: '结算号' })
  number: string;

  /** 备注 */
  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark: string;
}
