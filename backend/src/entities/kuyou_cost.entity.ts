import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_cost
 */
@Entity('kuyou_cost')
export class Cost {

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

  /** 业务类型:1=采购,2=销售,3=采购退回,4=销售退回 */
  @Column({ name: 'business_type', type: 'varchar', length: 255, nullable: true, comment: '业务类型:1=采购,2=销售,3=采购退回,4=销售退回' })
  businessType: string;

  /** 供应商 */
  @Column({ name: 'suppliers_id', type: 'int', nullable: true, comment: '供应商' })
  suppliersId: number;

  /** 源单往来单位 */
  @Column({ name: 'suppliers_ids', type: 'int', nullable: true, comment: '源单往来单位' })
  suppliersIds: number;

  /** 支出类别 */
  @Column({ name: 'expend_type_id', type: 'int', nullable: true, comment: '支出类别' })
  expendTypeId: number;

  /** 客户 */
  @Column({ name: 'customers_id', type: 'int', nullable: true, comment: '客户' })
  customersId: number;

  /** 收入类别 */
  @Column({ name: 'income_type_id', type: 'int', nullable: true, comment: '收入类别' })
  incomeTypeId: number;

  /** 源单号 */
  @Column({ name: 'purchase_number', type: 'varchar', length: 50, nullable: true, comment: '源单号' })
  purchaseNumber: string;

  /** 源单日期 */
  @Column({ name: 'purchase_times', type: 'int', nullable: true, comment: '源单日期' })
  purchaseTimes: number;

  /** 金额 */
  @Column({ name: 'money', type: 'double', nullable: true, comment: '金额' })
  money: number;

  /** 未付金额 */
  @Column({ name: 'pay_money', type: 'double', nullable: true, comment: '未付金额' })
  payMoney: number;

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
