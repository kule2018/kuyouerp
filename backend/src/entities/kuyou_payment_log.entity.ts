import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_payment_log
 */
@Entity('kuyou_payment_log')
export class PaymentLog {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 供应商编号 */
  @Column({ name: 'suppliers_code', type: 'varchar', length: 50, nullable: true, comment: '供应商编号' })
  suppliersCode: string;

  /** 业务类型:1=普通采购,2=采购退回,3=付款,4=退款,5=期初应付款,6=期初预付款,7=核销 */
  @Column({ name: 'business_type', type: 'varchar', length: 255, nullable: true, comment: '业务类型:1=普通采购,2=采购退回,3=付款,4=退款,5=期初应付款,6=期初预付款,7=核销' })
  businessType: string;

  /** 单据日期 */
  @Column({ name: 'bill_time', type: 'bigint', nullable: true, comment: '单据日期' })
  billTime: number;

  /** 源单据编号 */
  @Column({ name: 'bill_code', type: 'varchar', length: 50, nullable: true, comment: '源单据编号' })
  billCode: string;

  /** 单据编号 */
  @Column({ name: 'bill_codes', type: 'varchar', length: 50, nullable: true, comment: '单据编号' })
  billCodes: string;

  /** 采购金额 */
  @Column({ name: 'purchase_money', type: 'double', nullable: true, comment: '采购金额' })
  purchaseMoney: number;

  @Column({ name: 'money_tax_price', type: 'double', nullable: true })
  moneyTaxPrice: number;

  /** 优惠金额 */
  @Column({ name: 'discount_money', type: 'double', nullable: true, comment: '优惠金额' })
  discountMoney: number;

  /** 优惠后金额 */
  @Column({ name: 'real_money', type: 'double', nullable: true, comment: '优惠后金额' })
  realMoney: number;

  /** 本次付款 */
  @Column({ name: 'pay_money', type: 'double', nullable: true, comment: '本次付款' })
  payMoney: number;

  /** 应付款余额 */
  @Column({ name: 'give_money', type: 'double', nullable: true, comment: '应付款余额' })
  giveMoney: number;

  /** 备注 */
  @Column({ name: 'reamrk', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  reamrk: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;
}
