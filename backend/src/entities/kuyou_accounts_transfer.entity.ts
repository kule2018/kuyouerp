import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_accounts_transfer
 */
@Entity('kuyou_accounts_transfer')
export class AccountsTransfer {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: true, comment: '单据编号' })
  purchaseCode: string;

  /** 转账日期 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '转账日期' })
  purchaseTime: number;

  /** 合计金额 */
  @Column({ name: 'money', type: 'double', nullable: true, comment: '合计金额' })
  money: number;

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
