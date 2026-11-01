import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_enclosure
 */
@Entity('kuyou_enclosure')
export class Enclosure {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 图片 */
  @Column({ name: 'image', type: 'varchar', length: 255, nullable: false, default: '', comment: '图片' })
  image: string;

  /** 类型:1=购货,2=销货 */
  @Column({ name: 'type', type: 'varchar', length: 255, nullable: true, default: '1', comment: '类型:1=购货,2=销货' })
  type: string;

  /** 状态:0=禁用,1=启用 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: true, default: '1', comment: '状态:0=禁用,1=启用' })
  status: string;

  /** 上传日期 */
  @Column({ name: 'upload_date', type: 'varchar', length: 30, nullable: true, comment: '上传日期' })
  uploadDate: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
