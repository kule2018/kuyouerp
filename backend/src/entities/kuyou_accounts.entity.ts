import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_accounts
 */
@Entity('kuyou_accounts')
export class Accounts {

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
  @Column({ name: 'balance', type: 'double', nullable: true, comment: '当前余额' })
  balance: number;

  /** 期初余额 */
  @Column({ name: 'start_account_balance', type: 'double', nullable: false, default: '0.0000', comment: '期初余额' })
  startAccountBalance: number;

  /** 建账日期 */
  @Column({ name: 'start_account_time', type: 'varchar', length: 20, nullable: false, default: '', comment: '建账日期' })
  startAccountTime: string;

  /** 账户类型:1=现金,2=银行存款 */
  @Column({ name: 'account_type_id', type: 'varchar', length: 255, nullable: false, default: '1', comment: '账户类型:1=现金,2=银行存款' })
  accountTypeId: string;

  /** 默认:0=否,1=是 */
  @Column({ name: 'is_default', type: 'varchar', length: 255, nullable: true, default: '0', comment: '默认:0=否,1=是' })
  isDefault: string;

  /** 状态:0=关闭,1=正常 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: true, default: '1', comment: '状态:0=关闭,1=正常' })
  status: string;

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
