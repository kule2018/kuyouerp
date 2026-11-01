import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_inventory_info
 */
@Entity('kuyou_inventory_info')
export class InventoryInfo {

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

  /** 商品类别 */
  @Column({ name: 'goods_type', type: 'int', nullable: true, comment: '商品类别' })
  goodsType: number;

  /** 商品ID */
  @Column({ name: 'goods_id', type: 'int', nullable: true, comment: '商品ID' })
  goodsId: number;

  /** 仓库ID */
  @Column({ name: 'stores_id', type: 'int', nullable: true, comment: '仓库ID' })
  storesId: number;

  /** 商品属性 */
  @Column({ name: 'goods_attr', type: 'int', nullable: true, comment: '商品属性' })
  goodsAttr: number;

  /** 系统库存 */
  @Column({ name: 'stock', type: 'double', nullable: true, comment: '系统库存' })
  stock: number;

  /** 盘点库存 */
  @Column({ name: 'invertory_stock', type: 'double', nullable: true, comment: '盘点库存' })
  invertoryStock: number;

  /** 盘盈盘亏 */
  @Column({ name: 'profit', type: 'double', nullable: true, comment: '盘盈盘亏' })
  profit: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
