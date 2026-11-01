import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_accounts_log
 */
@Entity('kuyou_accounts_log')
export class AccountsLog {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 账户编号 */
  @Column({ name: 'account_coding', type: 'varchar', length: 100, nullable: false, comment: '账户编号' })
  accountCoding: string;

  /** 账户名称 */
  @Column({ name: 'account_name', type: 'varchar', length: 100, nullable: false, comment: '账户名称' })
  accountName: string;

  /** 当前余额 */
  @Column({ name: 'balance', type: 'double', nullable: false, default: '0.0000', comment: '当前余额' })
  balance: number;

  /** 收入 */
  @Column({ name: 'income', type: 'double', nullable: true, comment: '收入' })
  income: number;

  /** 支出 */
  @Column({ name: 'expenditure', type: 'double', nullable: true, comment: '支出' })
  expenditure: number;

  /** 日期 */
  @Column({ name: 'pay_time', type: 'bigint', nullable: true, comment: '日期' })
  payTime: number;

  /** 单据编号 */
  @Column({ name: 'bill_code', type: 'varchar', length: 50, nullable: true, comment: '单据编号' })
  billCode: string;

  /** 业务类型:1=期初余额,2=普通采购,3=购货付款,4=购货退货,5=销货,6=销货退货,7=收款单,8=付款单,9=其他收入单,10=其他支出单,11=转账单转入,12=转账单转出 */
  @Column({ name: 'business_type', type: 'tinyint', nullable: true, comment: '业务类型:1=期初余额,2=普通采购,3=购货付款,4=购货退货,5=销货,6=销货退货,7=收款单,8=付款单,9=其他收入单,10=其他支出单,11=转账单转入,12=转账单转出' })
  businessType: number;

  /** 往来单位 */
  @Column({ name: 'supplyer_code', type: 'varchar', length: 50, nullable: true, comment: '往来单位' })
  supplyerCode: string;

  /** 往来单位 */
  @Column({ name: 'customers_id', type: 'int', nullable: true, comment: '往来单位' })
  customersId: number;

  /** 收/付款人 */
  @Column({ name: 'payment', type: 'int', nullable: true, comment: '收/付款人' })
  payment: number;

  /** 备注 */
  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;

  /** 删除时间 */
  @Column({ name: 'deletetime', type: 'bigint', nullable: true, comment: '删除时间' })
  deletetime: number;
}
