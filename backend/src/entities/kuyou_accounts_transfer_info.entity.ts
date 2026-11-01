import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_accounts_transfer_info
 */
@Entity('kuyou_accounts_transfer_info')
export class AccountsTransferInfo {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: true, comment: '单据编号' })
  purchaseCode: string;

  /** 转账单ID */
  @Column({ name: 'purchase_id', type: 'int', nullable: true, comment: '转账单ID' })
  purchaseId: number;

  /** 转账日期 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '转账日期' })
  purchaseTime: number;

  /** 转出账户 */
  @Column({ name: 'accounts_out_id', type: 'int', nullable: true, comment: '转出账户' })
  accountsOutId: number;

  /** 转入账户 */
  @Column({ name: 'accounts_enter_id', type: 'int', nullable: true, comment: '转入账户' })
  accountsEnterId: number;

  /** 结算方式 */
  @Column({ name: 'settlementtype_id', type: 'int', nullable: true, comment: '结算方式' })
  settlementtypeId: number;

  /** 结算号 */
  @Column({ name: 'settlement_number', type: 'varchar', length: 50, nullable: true, comment: '结算号' })
  settlementNumber: string;

  /** 金额 */
  @Column({ name: 'money', type: 'double', nullable: true, comment: '金额' })
  money: number;

  /** 备注 */
  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
