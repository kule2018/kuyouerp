import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_writeoff_info
 */
@Entity('kuyou_writeoff_info')
export class WriteoffInfo {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 核销单ID */
  @Column({ name: 'collection_id', type: 'int', nullable: false, default: '0', comment: '核销单ID' })
  collectionId: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: false, default: '', comment: '单据编号' })
  purchaseCode: string;

  /** 单据类型:1=预收单,2=预付单,3=应收,4=应付,5=期初应收/付款,6=期初预收/付款 */
  @Column({ name: 'purchase_type', type: 'varchar', length: 255, nullable: true, comment: '单据类型:1=预收单,2=预付单,3=应收,4=应付,5=期初应收/付款,6=期初预收/付款' })
  purchaseType: string;

  /** 单据时间 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '单据时间' })
  purchaseTime: number;

  /** 类型:1=购货/销货,2=退货,3=期初,4=核销 */
  @Column({ name: 'type', type: 'varchar', length: 255, nullable: true, default: '1', comment: '类型:1=购货/销货,2=退货,3=期初,4=核销' })
  type: string;

  /** 原单编号 */
  @Column({ name: 'purchase_number', type: 'varchar', length: 50, nullable: false, default: '', comment: '原单编号' })
  purchaseNumber: string;

  /** 类型:1=预收冲应收,2=预付冲应付,3=应收冲应付,4=应收转应收,5=应付转应付 */
  @Column({ name: 'business_type', type: 'tinyint', nullable: false, default: '0', comment: '类型:1=预收冲应收,2=预付冲应付,3=应收冲应付,4=应收转应收,5=应付转应付' })
  businessType: number;

  /** 单据日期 */
  @Column({ name: 'times', type: 'int', nullable: false, default: '0', comment: '单据日期' })
  times: number;

  /** 单据金额 */
  @Column({ name: 'money', type: 'double', nullable: false, default: '0.0000', comment: '单据金额' })
  money: number;

  /** 已核销金额 */
  @Column({ name: 'write_off', type: 'double', nullable: true, comment: '已核销金额' })
  writeOff: number;

  /** 未核销金额 */
  @Column({ name: 'write_off_money', type: 'double', nullable: true, comment: '未核销金额' })
  writeOffMoney: number;

  /** 本次核销金额 */
  @Column({ name: 'write_off_price', type: 'double', nullable: true, default: '0.0000', comment: '本次核销金额' })
  writeOffPrice: number;

  @Column({ name: 'old_money', type: 'double', nullable: true })
  oldMoney: number;

  @Column({ name: 'old_status', type: 'int', nullable: true })
  oldStatus: number;

  /** 位置:1=上,2=下 */
  @Column({ name: 'top', type: 'varchar', length: 255, nullable: true, default: '1', comment: '位置:1=上,2=下' })
  top: string;

  /** 源单ID */
  @Column({ name: 'source_id', type: 'int', nullable: true, comment: '源单ID' })
  sourceId: number;

  /** 单据名称 */
  @Column({ name: 'business_name', type: 'varchar', length: 255, nullable: true, comment: '单据名称' })
  businessName: string;
}
