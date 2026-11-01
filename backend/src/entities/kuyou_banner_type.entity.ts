import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_banner_type
 */
@Entity('kuyou_banner_type')
export class BannerType {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 名称 */
  @Column({ name: 'name', type: 'varchar', length: 120, nullable: false, default: '', comment: '名称' })
  name: string;

  /** 广告位 */
  @Column({ name: 'type', type: 'tinyint', nullable: false, default: '0', comment: '广告位' })
  type: number;

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
