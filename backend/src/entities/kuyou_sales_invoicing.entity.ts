import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_sales_invoicing
 */
@Entity('kuyou_sales_invoicing')
export class SalesInvoicing {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 客户 */
  @Column({ name: 'customers_id', type: 'int', nullable: true, comment: '客户' })
  customersId: number;

  /** 状态:0=未收款,1=全部收款,2=部分收款,3=未退款,4=全部退款,5=部分退款 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: true, comment: '状态:0=未收款,1=全部收款,2=部分收款,3=未退款,4=全部退款,5=部分退款' })
  status: string;

  /** 单据日期 */
  @Column({ name: 'bill_time', type: 'bigint', nullable: true, comment: '单据日期' })
  billTime: number;

  /** 源单据编号 */
  @Column({ name: 'bill_code', type: 'varchar', length: 50, nullable: true, comment: '源单据编号' })
  billCode: string;

  /** 单据编号 */
  @Column({ name: 'bill_codes', type: 'varchar', length: 50, nullable: true, comment: '单据编号' })
  billCodes: string;

  /** 金额 */
  @Column({ name: 'money', type: 'double', nullable: true, comment: '金额' })
  money: number;

  /** 税额 */
  @Column({ name: 'tax', type: 'double', nullable: true, comment: '税额' })
  tax: number;

  /** 价税合计 */
  @Column({ name: 'real_money', type: 'double', nullable: true, comment: '价税合计' })
  realMoney: number;

  /** 客户承担费用 */
  @Column({ name: 'customers_money', type: 'double', nullable: true, default: '0.0000', comment: '客户承担费用' })
  customersMoney: number;

  /** 已开票金额 */
  @Column({ name: 'pay_money', type: 'double', nullable: true, default: '0.0000', comment: '已开票金额' })
  payMoney: number;

  /** 未开票金额 */
  @Column({ name: 'give_money', type: 'double', nullable: true, comment: '未开票金额' })
  giveMoney: number;

  /** 开票状态:0=未开,1=已开 */
  @Column({ name: 'invoice_status', type: 'varchar', length: 255, nullable: true, default: '0', comment: '开票状态:0=未开,1=已开' })
  invoiceStatus: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;
}
