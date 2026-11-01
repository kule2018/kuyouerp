import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_third_account
 */
@Entity('kuyou_third_account')
export class ThirdAccount {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 名称 */
  @Column({ name: 'name', type: 'varchar', length: 120, nullable: false, default: '', comment: '名称' })
  name: string;

  /** 图片 */
  @Column({ name: 'image', type: 'varchar', length: 255, nullable: false, default: '', comment: '图片' })
  image: string;

  /** 账号 */
  @Column({ name: 'account', type: 'varchar', length: 30, nullable: false, default: '', comment: '账号' })
  account: string;

  /** 秘钥 */
  @Column({ name: 'salt', type: 'varchar', length: 100, nullable: true, comment: '秘钥' })
  salt: string;

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
