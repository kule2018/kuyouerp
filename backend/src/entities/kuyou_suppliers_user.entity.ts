import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_suppliers_user
 */
@Entity('kuyou_suppliers_user')
export class SuppliersUser {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 供应商编号 */
  @Column({ name: 'supplyer_code', type: 'varchar', length: 30, nullable: false, default: '', comment: '供应商编号' })
  supplyerCode: string;

  /** 供应商ID */
  @Column({ name: 'sid', type: 'int', nullable: true, comment: '供应商ID' })
  sid: number;

  /** 联系人名称 */
  @Column({ name: 'first_connect_name', type: 'varchar', length: 100, nullable: false, default: '', comment: '联系人名称' })
  firstConnectName: string;

  /** 手机 */
  @Column({ name: 'first_connect_mobile', type: 'varchar', length: 11, nullable: false, comment: '手机' })
  firstConnectMobile: string;

  /** 座机 */
  @Column({ name: 'first_connect_phone', type: 'varchar', length: 20, nullable: false, comment: '座机' })
  firstConnectPhone: string;

  /** QQ/微信/Email */
  @Column({ name: 'qq_wx_email', type: 'varchar', length: 120, nullable: false, comment: 'QQ/微信/Email' })
  qqWxEmail: string;

  /** 联系地址 */
  @Column({ name: 'connect_address', type: 'varchar', length: 255, nullable: false, comment: '联系地址' })
  connectAddress: string;

  /** 首要联系人:0=否,1=是 */
  @Column({ name: 'is_first', type: 'tinyint', nullable: true, default: '0', comment: '首要联系人:0=否,1=是' })
  isFirst: number;

  /** 状态:0=禁用,1=正常 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: false, default: '1', comment: '状态:0=禁用,1=正常' })
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
