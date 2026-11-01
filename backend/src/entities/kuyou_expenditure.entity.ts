import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_expenditure
 */
@Entity('kuyou_expenditure')
export class Expenditure {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: true, comment: '单据编号' })
  purchaseCode: string;

  /** 单据日期 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '单据日期' })
  purchaseTime: number;

  /** 业务类型:1=其他支出,2=其他 */
  @Column({ name: 'business_type', type: 'varchar', length: 255, nullable: true, comment: '业务类型:1=其他支出,2=其他' })
  businessType: string;

  /** 供应商 */
  @Column({ name: 'suppliers_id', type: 'int', nullable: true, comment: '供应商' })
  suppliersId: number;

  /** 账户 */
  @Column({ name: 'accounts_id', type: 'int', nullable: true, comment: '账户' })
  accountsId: number;

  /** 采购销售ID */
  @Column({ name: 'cost_id', type: 'int', nullable: true, comment: '采购销售ID' })
  costId: number;

  /** 金额 */
  @Column({ name: 'money', type: 'double', nullable: true, comment: '金额' })
  money: number;

  /** 已付金额 */
  @Column({ name: 'pay_money', type: 'double', nullable: true, comment: '已付金额' })
  payMoney: number;

  /** 本次欠款 */
  @Column({ name: 'arrears', type: 'double', nullable: true, comment: '本次欠款' })
  arrears: number;

  /** 备注 */
  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark: string;

  /** 制单人 */
  @Column({ name: 'preparation_id', type: 'int', nullable: true, comment: '制单人' })
  preparationId: number;

  /** 最后操作人 */
  @Column({ name: 'operation_id', type: 'int', nullable: true, comment: '最后操作人' })
  operationId: number;

  /** 审核人 */
  @Column({ name: 'examine_id', type: 'int', nullable: true, comment: '审核人' })
  examineId: number;

  /** 审核状态:0=未审核,1=已审核 */
  @Column({ name: 'examine_status', type: 'varchar', length: 255, nullable: true, default: '0', comment: '审核状态:0=未审核,1=已审核' })
  examineStatus: string;

  /** 审核时间 */
  @Column({ name: 'examine_time', type: 'bigint', nullable: true, comment: '审核时间' })
  examineTime: number;

  /** 打印次数 */
  @Column({ name: 'print_num', type: 'int', nullable: true, comment: '打印次数' })
  printNum: number;

  /** 付款状态:0=未付款,1=全部付款,2=部分付款 */
  @Column({ name: 'pay_status', type: 'varchar', length: 255, nullable: true, default: '0', comment: '付款状态:0=未付款,1=全部付款,2=部分付款' })
  payStatus: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
