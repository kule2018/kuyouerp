import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_type
 */
@Entity('kuyou_goods_type')
export class GoodsType {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 类别名称 */
  @Column({ name: 'supplier_type_name', type: 'varchar', length: 120, nullable: false, default: '', comment: '类别名称' })
  supplierTypeName: string;

  /** 图片 */
  @Column({ name: 'supplier_type_image', type: 'varchar', length: 255, nullable: true, comment: '图片' })
  supplierTypeImage: string;

  /** 上级 */
  @Column({ name: 'pid', type: 'int', nullable: false, default: '0', comment: '上级' })
  pid: number;

  /** path */
  @Column({ name: 'path', type: 'varchar', length: 255, nullable: true, comment: 'path' })
  path: string;

  /** 状态:0=禁用,1=正常 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: false, default: '1', comment: '状态:0=禁用,1=正常' })
  status: string;

  @Column({ name: 'weigh', type: 'int', nullable: true, default: '0' })
  weigh: number;

  /** 订货通显示状态:0=否,1=是 */
  @Column({ name: 'order_status', type: 'varchar', length: 255, nullable: true, default: '1', comment: '订货通显示状态:0=否,1=是' })
  orderStatus: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
