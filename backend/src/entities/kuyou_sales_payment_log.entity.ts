import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_sales_payment_log
 */
@Entity('kuyou_sales_payment_log')
export class SalesPaymentLog {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 客户 */
  @Column({ name: 'customers_id', type: 'int', nullable: true, comment: '客户' })
  customersId: number;

  /** 销售员 */
  @Column({ name: 'sale_user', type: 'int', nullable: true, comment: '销售员' })
  saleUser: number;

  /** 业务类型:1=销货,2=销货退回,3=付款,4=退款,5=期初应收款,6=期初预收款,7=核销 */
  @Column({ name: 'business_type', type: 'varchar', length: 255, nullable: true, comment: '业务类型:1=销货,2=销货退回,3=付款,4=退款,5=期初应收款,6=期初预收款,7=核销' })
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

  /** 销售金额 */
  @Column({ name: 'purchase_money', type: 'double', nullable: true, comment: '销售金额' })
  purchaseMoney: number;

  /** 价税合计 */
  @Column({ name: 'money_tax_price', type: 'double', nullable: true, comment: '价税合计' })
  moneyTaxPrice: number;

  /** 优惠金额 */
  @Column({ name: 'discount_money', type: 'double', nullable: true, comment: '优惠金额' })
  discountMoney: number;

  /** 优惠后金额 */
  @Column({ name: 'real_money', type: 'double', nullable: true, comment: '优惠后金额' })
  realMoney: number;

  /** 客户承担费用 */
  @Column({ name: 'customers_money', type: 'double', nullable: true, default: '0.0000', comment: '客户承担费用' })
  customersMoney: number;

  /** 本次付款 */
  @Column({ name: 'pay_money', type: 'double', nullable: true, comment: '本次付款' })
  payMoney: number;

  /** 应收款余额 */
  @Column({ name: 'give_money', type: 'double', nullable: true, comment: '应收款余额' })
  giveMoney: number;

  /** 备注 */
  @Column({ name: 'reamrk', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  reamrk: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;
}
