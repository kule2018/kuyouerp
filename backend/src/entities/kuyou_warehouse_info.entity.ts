import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_warehouse_info
 */
@Entity('kuyou_warehouse_info')
export class WarehouseInfo {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 盘点编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: true, comment: '盘点编号' })
  purchaseCode: string;

  /** 盘点时间 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '盘点时间' })
  purchaseTime: number;

  /** 商品 */
  @Column({ name: 'goods_id', type: 'int', nullable: true, comment: '商品' })
  goodsId: number;

  /** 商品属性 */
  @Column({ name: 'goods_attr', type: 'int', nullable: true, comment: '商品属性' })
  goodsAttr: number;

  /** 商品单位 */
  @Column({ name: 'goods_unit', type: 'int', nullable: true, comment: '商品单位' })
  goodsUnit: number;

  /** 仓库 */
  @Column({ name: 'stores_id', type: 'int', nullable: true, comment: '仓库' })
  storesId: number;

  /** 可用库存 */
  @Column({ name: 'stock', type: 'double', nullable: true, comment: '可用库存' })
  stock: number;

  /** 数量 */
  @Column({ name: 'number', type: 'double', nullable: true, comment: '数量' })
  number: number;

  /** 基础数量 */
  @Column({ name: 'basic_nmber', type: 'double', nullable: true, comment: '基础数量' })
  basicNmber: number;

  /** 序列号 */
  @Column({ name: 'period', type: 'text', nullable: true, comment: '序列号' })
  period: string;

  /** 出库单价 */
  @Column({ name: 'unit_price', type: 'double', nullable: true, comment: '出库单价' })
  unitPrice: number;

  /** 出库金额 */
  @Column({ name: 'price', type: 'double', nullable: true, comment: '出库金额' })
  price: number;

  /** 备注 */
  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark: string;

  /** 批次 */
  @Column({ name: 'batch', type: 'varchar', length: 255, nullable: true, comment: '批次' })
  batch: string;

  /** 批次ID */
  @Column({ name: 'batch_id', type: 'int', nullable: true, comment: '批次ID' })
  batchId: number;

  /** 生产日期 */
  @Column({ name: 'manufacture', type: 'int', nullable: true, comment: '生产日期' })
  manufacture: number;

  /** 保质期 */
  @Column({ name: 'guarantee', type: 'int', nullable: true, comment: '保质期' })
  guarantee: number;

  /** 有效期至 */
  @Column({ name: 'validity', type: 'int', nullable: true, comment: '有效期至' })
  validity: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
