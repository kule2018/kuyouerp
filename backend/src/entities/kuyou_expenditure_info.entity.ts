import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_expenditure_info
 */
@Entity('kuyou_expenditure_info')
export class ExpenditureInfo {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: true, comment: '单据编号' })
  purchaseCode: string;

  /** 收入单ID */
  @Column({ name: 'purchase_id', type: 'int', nullable: true, comment: '收入单ID' })
  purchaseId: number;

  /** 单据日期 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '单据日期' })
  purchaseTime: number;

  /** 业务类型:1=其他收入 */
  @Column({ name: 'business_type', type: 'varchar', length: 255, nullable: true, comment: '业务类型:1=其他收入' })
  businessType: string;

  /** 供应商 */
  @Column({ name: 'suppliers_id', type: 'int', nullable: true, comment: '供应商' })
  suppliersId: number;

  /** 支出类别 */
  @Column({ name: 'expend_type_id', type: 'int', nullable: true, comment: '支出类别' })
  expendTypeId: number;

  /** 金额 */
  @Column({ name: 'money', type: 'double', nullable: true, comment: '金额' })
  money: number;

  /** 备注 */
  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark: string;

  @Column({ name: 'cost_id', type: 'int', nullable: true })
  costId: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
