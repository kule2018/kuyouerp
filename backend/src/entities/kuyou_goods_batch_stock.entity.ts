import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_batch_stock
 */
@Entity('kuyou_goods_batch_stock')
export class GoodsBatchStock {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  @Column({ name: 'batch_id', type: 'int', nullable: true })
  batchId: number;

  /** 商品ID */
  @Column({ name: 'goods_id', type: 'int', nullable: false, default: '0', comment: '商品ID' })
  goodsId: number;

  /** 商品编号 */
  @Column({ name: 'goods_code', type: 'varchar', length: 30, nullable: true, comment: '商品编号' })
  goodsCode: string;

  /** 属性组合ID */
  @Column({ name: 'attribute_id', type: 'int', nullable: true, default: '0', comment: '属性组合ID' })
  attributeId: number;

  /** 仓库ID */
  @Column({ name: 'stores_id', type: 'int', nullable: false, default: '0', comment: '仓库ID' })
  storesId: number;

  /** 库存 */
  @Column({ name: 'stock', type: 'double', nullable: false, default: '0.0000', comment: '库存' })
  stock: number;

  /** 状态:0=关闭,1=正常 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: false, default: '1', comment: '状态:0=关闭,1=正常' })
  status: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
