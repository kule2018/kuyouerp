import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_accounts_copewith
 */
@Entity('kuyou_accounts_copewith')
export class AccountsCopewith {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 供应商 */
  @Column({ name: 'suppliers_id', type: 'int', nullable: false, default: '0', comment: '供应商' })
  suppliersId: number;

  /** 单据日期 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '单据日期' })
  purchaseTime: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 100, nullable: false, default: '', comment: '单据编号' })
  purchaseCode: string;

  /** 业务类型:0=期初余额,1=预收冲应收,2=预付冲应付,3=应收冲应付,4=应收转应收,5=应付转应付,6=普通采购,7=采购退回,8=其他支出,9=付款,10=核销 */
  @Column({ name: 'business_type', type: 'varchar', length: 255, nullable: true, comment: '业务类型:0=期初余额,1=预收冲应收,2=预付冲应付,3=应收冲应付,4=应收转应收,5=应付转应付,6=普通采购,7=采购退回,8=其他支出,9=付款,10=核销' })
  businessType: string;

  /** 增加应付款 */
  @Column({ name: 'receivable', type: 'double', nullable: true, default: '0.0000', comment: '增加应付款' })
  receivable: number;

  /** 增加预付款 */
  @Column({ name: 'advance', type: 'double', nullable: true, default: '0.0000', comment: '增加预付款' })
  advance: number;

  /** 备注 */
  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark: string;

  /** 购货金额 */
  @Column({ name: 'sale_money', type: 'double', nullable: true, comment: '购货金额' })
  saleMoney: number;

  /** 应付金额 */
  @Column({ name: 'receivable_money', type: 'double', nullable: true, comment: '应付金额' })
  receivableMoney: number;

  /** 优惠金额 */
  @Column({ name: 'amount', type: 'double', nullable: true, comment: '优惠金额' })
  amount: number;

  @Column({ name: 'cost', type: 'double', nullable: true })
  cost: number;

  /** 实际付款金额 */
  @Column({ name: 'real_money', type: 'double', nullable: true, comment: '实际付款金额' })
  realMoney: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
