import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_factory
 */
@Entity('kuyou_factory')
export class Factory {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 编号 */
  @Column({ name: 'customer_code', type: 'varchar', length: 50, nullable: true, comment: '编号' })
  customerCode: string;

  /** 类别 */
  @Column({ name: 'customertype_id', type: 'int', nullable: false, default: '0', comment: '类别' })
  customertypeId: number;

  /** 等级 */
  @Column({ name: 'customerlevel_id', type: 'int', nullable: false, default: '1', comment: '等级' })
  customerlevelId: number;

  /** 名称 */
  @Column({ name: 'customer_name', type: 'varchar', length: 150, nullable: false, default: '', comment: '名称' })
  customerName: string;

  /** 销售人员 */
  @Column({ name: 'saler', type: 'varchar', length: 100, nullable: false, default: '', comment: '销售人员' })
  saler: string;

  /** 联系人 */
  @Column({ name: 'connet_name', type: 'varchar', length: 50, nullable: false, default: '', comment: '联系人' })
  connetName: string;

  /** 手机 */
  @Column({ name: 'customer_mobile', type: 'varchar', length: 11, nullable: false, default: '', comment: '手机' })
  customerMobile: string;

  /** 座机 */
  @Column({ name: 'customer_phone', type: 'varchar', length: 20, nullable: false, default: '', comment: '座机' })
  customerPhone: string;

  /** QQ/微信/Email */
  @Column({ name: 'qq_wx_email', type: 'varchar', length: 100, nullable: false, default: '', comment: 'QQ/微信/Email' })
  qqWxEmail: string;

  /** 应收款余额 */
  @Column({ name: 'need_receive_account', type: 'double', nullable: false, default: '0.0000', comment: '应收款余额' })
  needReceiveAccount: number;

  /** 期初应收款 */
  @Column({ name: 'receive_account', type: 'double', nullable: true, comment: '期初应收款' })
  receiveAccount: number;

  /** 期初预收款 */
  @Column({ name: 'opening_prepayment', type: 'double', nullable: true, comment: '期初预收款' })
  openingPrepayment: number;

  /** 纳税人识别号 */
  @Column({ name: 'identification', type: 'varchar', length: 100, nullable: true, comment: '纳税人识别号' })
  identification: string;

  /** 收货地址 */
  @Column({ name: 'getgoods_address', type: 'varchar', length: 255, nullable: false, default: '', comment: '收货地址' })
  getgoodsAddress: string;

  /** 备注 */
  @Column({ name: 'note', type: 'varchar', length: 255, nullable: false, default: '', comment: '备注' })
  note: string;

  /** 开户银行 */
  @Column({ name: 'deposit_bank', type: 'varchar', length: 255, nullable: true, comment: '开户银行' })
  depositBank: string;

  /** 银行卡号 */
  @Column({ name: 'bank_number', type: 'varchar', length: 255, nullable: true, comment: '银行卡号' })
  bankNumber: string;

  /** 销售人员 */
  @Column({ name: 'staff_member_id', type: 'int', nullable: true, comment: '销售人员' })
  staffMemberId: number;

  /** 余额日期 */
  @Column({ name: 'account_time', type: 'bigint', nullable: true, comment: '余额日期' })
  accountTime: number;

  /** 三方ID */
  @Column({ name: 'third_id', type: 'int', nullable: true, default: '0', comment: '三方ID' })
  thirdId: number;

  /** 状态 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: false, default: '0', comment: '状态' })
  status: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
