import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_collection
 */
@Entity('kuyou_collection')
export class Collection {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: true, comment: '单据编号' })
  purchaseCode: string;

  /** 单据时间 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '单据时间' })
  purchaseTime: number;

  /** 类型:1=预收单,2=收款单 */
  @Column({ name: 'business_type', type: 'varchar', length: 255, nullable: true, default: '1', comment: '类型:1=预收单,2=收款单' })
  businessType: string;

  /** 客户 */
  @Column({ name: 'customers_id', type: 'int', nullable: true, comment: '客户' })
  customersId: number;

  /** 收款合计 */
  @Column({ name: 'money', type: 'double', nullable: true, comment: '收款合计' })
  money: number;

  /** 核销金额 */
  @Column({ name: 'write_off', type: 'double', nullable: true, comment: '核销金额' })
  writeOff: number;

  /** 整单折扣 */
  @Column({ name: 'discount', type: 'double', nullable: true, comment: '整单折扣' })
  discount: number;

  /** 预收款 */
  @Column({ name: 'advance', type: 'double', nullable: true, comment: '预收款' })
  advance: number;

  /** 收款人 */
  @Column({ name: 'staff_member_id', type: 'int', nullable: true, comment: '收款人' })
  staffMemberId: number;

  /** 备注 */
  @Column({ name: 'remarks', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remarks: string;

  /** 制单人 */
  @Column({ name: 'preparation_id', type: 'int', nullable: true, comment: '制单人' })
  preparationId: number;

  /** 审核人 */
  @Column({ name: 'examine_id', type: 'int', nullable: true, comment: '审核人' })
  examineId: number;

  /** 最后操作人 */
  @Column({ name: 'operation_id', type: 'int', nullable: true, comment: '最后操作人' })
  operationId: number;

  /** 审核时间 */
  @Column({ name: 'examine_time', type: 'bigint', nullable: true, comment: '审核时间' })
  examineTime: number;

  /** 审核状态:0=未审核,1=已审核 */
  @Column({ name: 'examine_status', type: 'varchar', length: 255, nullable: false, default: '0', comment: '审核状态:0=未审核,1=已审核' })
  examineStatus: string;

  /** 打印次数 */
  @Column({ name: 'print_num', type: 'int', nullable: true, comment: '打印次数' })
  printNum: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
