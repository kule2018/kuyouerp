import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_allocation_info
 */
@Entity('kuyou_allocation_info')
export class AllocationInfo {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 调拨单ID */
  @Column({ name: 'allocation_id', type: 'varchar', length: 50, nullable: false, default: '', comment: '调拨单ID' })
  allocationId: string;

  /** 商品ID */
  @Column({ name: 'goods_id', type: 'int', nullable: true, comment: '商品ID' })
  goodsId: number;

  /** 商品属性 */
  @Column({ name: 'goods_attr', type: 'int', nullable: true, comment: '商品属性' })
  goodsAttr: number;

  /** 商品单位 */
  @Column({ name: 'goods_unit', type: 'int', nullable: true, comment: '商品单位' })
  goodsUnit: number;

  /** 调出仓库 */
  @Column({ name: 'stores_out', type: 'int', nullable: true, comment: '调出仓库' })
  storesOut: number;

  /** 调入仓库 */
  @Column({ name: 'stores_enter', type: 'int', nullable: true, comment: '调入仓库' })
  storesEnter: number;

  /** 数量 */
  @Column({ name: 'number', type: 'int', nullable: true, comment: '数量' })
  number: number;

  /** 批次ID */
  @Column({ name: 'goods_batch_id', type: 'int', nullable: true, comment: '批次ID' })
  goodsBatchId: number;

  /** 批次 */
  @Column({ name: 'goods_batch_name', type: 'varchar', length: 255, nullable: true, comment: '批次' })
  goodsBatchName: string;

  /** 序列号 */
  @Column({ name: 'goods_serial_id', type: 'text', nullable: true, comment: '序列号' })
  goodsSerialId: string;

  /** 分录备注 */
  @Column({ name: 'remarks', type: 'varchar', length: 255, nullable: true, comment: '分录备注' })
  remarks: string;

  /** 可用库存 */
  @Column({ name: 'allow_stock', type: 'double', nullable: true, default: '0.0000', comment: '可用库存' })
  allowStock: number;

  /** 商品备注 */
  @Column({ name: 'goods_note', type: 'varchar', length: 255, nullable: true, comment: '商品备注' })
  goodsNote: string;
}
