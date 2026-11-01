import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_attr
 */
@Entity('kuyou_goods_attr')
export class GoodsAttr {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 商品编号 */
  @Column({ name: 'goods_code', type: 'varchar', length: 30, nullable: false, default: '', comment: '商品编号' })
  goodsCode: string;

  /** 商品名称 */
  @Column({ name: 'goods_name', type: 'varchar', length: 255, nullable: false, default: '', comment: '商品名称' })
  goodsName: string;

  /** 商品条码 */
  @Column({ name: 'goods_barcode', type: 'varchar', length: 50, nullable: true, default: '', comment: '商品条码' })
  goodsBarcode: string;

  /** 商品ID */
  @Column({ name: 'goods_id', type: 'int', nullable: false, default: '0', comment: '商品ID' })
  goodsId: number;

  /** 属性组合ID */
  @Column({ name: 'attribute_id', type: 'int', nullable: true, comment: '属性组合ID' })
  attributeId: number;

  /** 属性编号 */
  @Column({ name: 'attr_code', type: 'varchar', length: 30, nullable: true, comment: '属性编号' })
  attrCode: string;

  /** 属性条码 */
  @Column({ name: 'barcode', type: 'varchar', length: 30, nullable: true, comment: '属性条码' })
  barcode: string;

  /** 计量单位 */
  @Column({ name: 'unit', type: 'int', nullable: false, default: '0', comment: '计量单位' })
  unit: number;

  /** 零售价 */
  @Column({ name: 'market_sell_price', type: 'double', nullable: true, comment: '零售价' })
  marketSellPrice: number;

  /** 批发价 */
  @Column({ name: 'wholesale_price', type: 'double', nullable: true, comment: '批发价' })
  wholesalePrice: number;

  /** vip会员价 */
  @Column({ name: 'vip_price', type: 'double', nullable: true, comment: 'vip会员价' })
  vipPrice: number;

  /** 折扣率1 */
  @Column({ name: 'discount', type: 'double', nullable: true, comment: '折扣率1' })
  discount: number;

  /** 折扣率2 */
  @Column({ name: 'discount2', type: 'double', nullable: true, comment: '折扣率2' })
  discount2: number;

  /** 预计采购价 */
  @Column({ name: 'purchase', type: 'double', nullable: true, comment: '预计采购价' })
  purchase: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
