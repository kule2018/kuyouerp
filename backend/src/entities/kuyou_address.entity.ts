import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_address
 */
@Entity('kuyou_address')
export class Address {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 地址简称 */
  @Column({ name: 'nickname', type: 'varchar', length: 100, nullable: true, comment: '地址简称' })
  nickname: string;

  /** 联系人 */
  @Column({ name: 'connect_name', type: 'varchar', length: 100, nullable: false, comment: '联系人' })
  connectName: string;

  /** 联系电话 */
  @Column({ name: 'connect_phone', type: 'varchar', length: 20, nullable: false, comment: '联系电话' })
  connectPhone: string;

  /** 手机号码 */
  @Column({ name: 'connect_mobile', type: 'varchar', length: 11, nullable: false, comment: '手机号码' })
  connectMobile: string;

  /** 省 */
  @Column({ name: 'province', type: 'int', nullable: false, default: '0', comment: '省' })
  province: number;

  /** 市 */
  @Column({ name: 'city', type: 'int', nullable: false, default: '0', comment: '市' })
  city: number;

  /** 区 */
  @Column({ name: 'area', type: 'int', nullable: false, default: '0', comment: '区' })
  area: number;

  /** 详细地址 */
  @Column({ name: 'detail_address', type: 'varchar', length: 255, nullable: false, comment: '详细地址' })
  detailAddress: string;

  /** 邮政编码 */
  @Column({ name: 'post_code', type: 'varchar', length: 50, nullable: false, comment: '邮政编码' })
  postCode: string;

  /** 默认地址:0=否,1=是 */
  @Column({ name: 'is_default', type: 'varchar', length: 255, nullable: false, default: '0', comment: '默认地址:0=否,1=是' })
  isDefault: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
