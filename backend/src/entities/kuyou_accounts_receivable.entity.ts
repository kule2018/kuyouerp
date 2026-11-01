import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_accounts_receivable
 */
@Entity('kuyou_accounts_receivable')
export class AccountsReceivable {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 客户 */
  @Column({ name: 'customers_id', type: 'int', nullable: false, default: '0', comment: '客户' })
  customersId: number;

  /** 单据日期 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '单据日期' })
  purchaseTime: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 100, nullable: false, default: '', comment: '单据编号' })
  purchaseCode: string;

  /** 业务类型:0=期初余额,1=预收冲应收,2=预付冲应付,3=应收冲应付,4=应收转应收,5=应付转应付,6=普通销售,7=销售退回,8=其他收入,9=收款,10=核销 */
  @Column({ name: 'business_type', type: 'varchar', length: 255, nullable: true, comment: '业务类型:0=期初余额,1=预收冲应收,2=预付冲应付,3=应收冲应付,4=应收转应收,5=应付转应付,6=普通销售,7=销售退回,8=其他收入,9=收款,10=核销' })
  businessType: string;

  /** 增加应收款 */
  @Column({ name: 'receivable', type: 'double', nullable: true, comment: '增加应收款' })
  receivable: number;

  /** 增加预收款 */
  @Column({ name: 'advance', type: 'double', nullable: true, comment: '增加预收款' })
  advance: number;

  /** 销售人员 */
  @Column({ name: 'staff_member_id', type: 'int', nullable: true, comment: '销售人员' })
  staffMemberId: number;

  /** 备注 */
  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark: string;

  /** 销售金额 */
  @Column({ name: 'sale_money', type: 'double', nullable: true, comment: '销售金额' })
  saleMoney: number;

  /** 应收金额 */
  @Column({ name: 'receivable_money', type: 'double', nullable: true, comment: '应收金额' })
  receivableMoney: number;

  /** 优惠金额 */
  @Column({ name: 'amount', type: 'double', nullable: true, comment: '优惠金额' })
  amount: number;

  /** 客户承担费用 */
  @Column({ name: 'cost', type: 'double', nullable: true, comment: '客户承担费用' })
  cost: number;

  /** 实际收款金额 */
  @Column({ name: 'real_money', type: 'double', nullable: true, comment: '实际收款金额' })
  realMoney: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
