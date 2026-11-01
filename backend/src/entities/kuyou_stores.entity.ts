import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_stores
 */
@Entity('kuyou_stores')
export class Stores {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 仓库编号 */
  @Column({ name: 'store_code', type: 'varchar', length: 30, nullable: false, default: '', comment: '仓库编号' })
  storeCode: string;

  /** 仓库名称 */
  @Column({ name: 'name', type: 'varchar', length: 255, nullable: false, default: '', comment: '仓库名称' })
  name: string;

  /** 状态:0=关闭,1=正常 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: true, default: '1', comment: '状态:0=关闭,1=正常' })
  status: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
