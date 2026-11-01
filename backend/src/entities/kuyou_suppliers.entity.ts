import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_suppliers
 */
@Entity('kuyou_suppliers')
export class Suppliers {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 供应商编号 */
  @Column({ name: 'supplyer_code', type: 'varchar', length: 30, nullable: false, default: '', comment: '供应商编号' })
  supplyerCode: string;

  /** 供应商类别 */
  @Column({ name: 'supplyertype_id', type: 'int', nullable: false, default: '0', comment: '供应商类别' })
  supplyertypeId: number;

  /** 供应商名称 */
  @Column({ name: 'supplyer_name', type: 'varchar', length: 120, nullable: false, comment: '供应商名称' })
  supplyerName: string;

  /** 联系人 */
  @Column({ name: 'first_connect_name', type: 'varchar', length: 100, nullable: false, default: '', comment: '联系人' })
  firstConnectName: string;

  /** 手机 */
  @Column({ name: 'first_connect_mobile', type: 'varchar', length: 11, nullable: false, comment: '手机' })
  firstConnectMobile: string;

  /** 座机 */
  @Column({ name: 'first_connect_phone', type: 'varchar', length: 20, nullable: true, default: '', comment: '座机' })
  firstConnectPhone: string;

  /** QQ/微信/Email */
  @Column({ name: 'qq_wx_email', type: 'varchar', length: 120, nullable: true, default: '', comment: 'QQ/微信/Email' })
  qqWxEmail: string;

  /** 联系地址 */
  @Column({ name: 'connect_address', type: 'varchar', length: 255, nullable: true, default: '', comment: '联系地址' })
  connectAddress: string;

  /** 备注 */
  @Column({ name: 'note', type: 'varchar', length: 255, nullable: true, default: '', comment: '备注' })
  note: string;

  /** 应付款余额 */
  @Column({ name: 'need_give_account', type: 'float', nullable: false, default: '0.00', comment: '应付款余额' })
  needGiveAccount: number;

  /** 期初应付款 */
  @Column({ name: 'receive_account', type: 'double', nullable: true, comment: '期初应付款' })
  receiveAccount: number;

  /** 余额日期 */
  @Column({ name: 'account_time', type: 'bigint', nullable: true, comment: '余额日期' })
  accountTime: number;

  /** 期初应付款 */
  @Column({ name: 'opening_payable', type: 'double', nullable: true, default: '0.0000', comment: '期初应付款' })
  openingPayable: number;

  /** 期初预付款 */
  @Column({ name: 'opening_prepayment', type: 'double', nullable: true, default: '0.0000', comment: '期初预付款' })
  openingPrepayment: number;

  /** 增值税税率 */
  @Column({ name: 'vat_rate', type: 'double', nullable: true, comment: '增值税税率' })
  vatRate: number;

  /** 纳税人识别号 */
  @Column({ name: 'identification', type: 'varchar', length: 50, nullable: true, comment: '纳税人识别号' })
  identification: string;

  /** 开户银行 */
  @Column({ name: 'deposit_bank', type: 'varchar', length: 150, nullable: true, comment: '开户银行' })
  depositBank: string;

  /** 银行卡号 */
  @Column({ name: 'bank_number', type: 'varchar', length: 30, nullable: true, comment: '银行卡号' })
  bankNumber: string;

  /** 状态:0=禁用,1=正常 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: false, default: '1', comment: '状态:0=禁用,1=正常' })
  status: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
