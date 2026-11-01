import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_writeoff_source
 */
@Entity('kuyou_writeoff_source')
export class WriteoffSource {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 单据类型:1=预收单,2=预付单,3=应收,4=应付,5=期初应收/付款,6=期初预收/付款 */
  @Column({ name: 'purchase_type', type: 'varchar', length: 255, nullable: true, comment: '单据类型:1=预收单,2=预付单,3=应收,4=应付,5=期初应收/付款,6=期初预收/付款' })
  purchaseType: string;

  /** 类型:1=购货/销货,2=退货,3=期初,4=核销 */
  @Column({ name: 'type', type: 'varchar', length: 255, nullable: true, comment: '类型:1=购货/销货,2=退货,3=期初,4=核销' })
  type: string;

  /** 供应商编号 */
  @Column({ name: 'suppliers_code', type: 'varchar', length: 50, nullable: true, comment: '供应商编号' })
  suppliersCode: string;

  /** 客户Id */
  @Column({ name: 'customers_id', type: 'int', nullable: true, comment: '客户Id' })
  customersId: number;

  /** 原单编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: false, default: '', comment: '原单编号' })
  purchaseCode: string;

  /** 单据时间 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '单据时间' })
  purchaseTime: number;

  /** 单据金额 */
  @Column({ name: 'price', type: 'double', nullable: true, default: '0.0000', comment: '单据金额' })
  price: number;

  /** 已核销金额 */
  @Column({ name: 'money', type: 'double', nullable: true, default: '0.0000', comment: '已核销金额' })
  money: number;

  /** 未核销金额 */
  @Column({ name: 'write_off', type: 'double', nullable: true, default: '0.0000', comment: '未核销金额' })
  writeOff: number;

  /** 备注 */
  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark: string;
}
