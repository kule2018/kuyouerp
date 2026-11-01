import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_supplyertype
 */
@Entity('kuyou_supplyertype')
export class Supplyertype {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 类别名称 */
  @Column({ name: 'supplier_type_name', type: 'varchar', length: 120, nullable: false, default: '', comment: '类别名称' })
  supplierTypeName: string;

  /** 图片 */
  @Column({ name: 'supplier_type_img', type: 'varchar', length: 255, nullable: false, default: '', comment: '图片' })
  supplierTypeImg: string;

  /** 上级 */
  @Column({ name: 'pid', type: 'int', nullable: false, default: '0', comment: '上级' })
  pid: number;

  /** path */
  @Column({ name: 'path', type: 'varchar', length: 255, nullable: true, comment: 'path' })
  path: string;

  /** 状态:0=禁用,1=正常 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: false, default: '1', comment: '状态:0=禁用,1=正常' })
  status: string;

  @Column({ name: 'weigh', type: 'int', nullable: true })
  weigh: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
