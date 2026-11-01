import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_invoicing_log
 */
@Entity('kuyou_invoicing_log')
export class InvoicingLog {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 供应商编号 */
  @Column({ name: 'suppliers_code', type: 'varchar', length: 50, nullable: true, comment: '供应商编号' })
  suppliersCode: string;

  /** 状态:0=未付款,1=全部付款,2=部分付款,3=未退款,4=全部退款,5=部分退款 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: true, comment: '状态:0=未付款,1=全部付款,2=部分付款,3=未退款,4=全部退款,5=部分退款' })
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

  /** 已开票金额 */
  @Column({ name: 'pay_money', type: 'double', nullable: true, default: '0.0000', comment: '已开票金额' })
  payMoney: number;

  /** 未开票金额 */
  @Column({ name: 'give_money', type: 'double', nullable: true, comment: '未开票金额' })
  giveMoney: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 开票时间 */
  @Column({ name: 'times', type: 'int', nullable: true, comment: '开票时间' })
  times: number;

  /** 发票号 */
  @Column({ name: 'invoice', type: 'varchar', length: 255, nullable: true, comment: '发票号' })
  invoice: string;

  /** 发票抬头 */
  @Column({ name: 'invoice_header', type: 'varchar', length: 255, nullable: true, comment: '发票抬头' })
  invoiceHeader: string;

  @Column({ name: 'invoicing_id', type: 'int', nullable: true })
  invoicingId: number;
}
