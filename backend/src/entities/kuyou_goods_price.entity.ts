import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_price
 */
@Entity('kuyou_goods_price')
export class GoodsPrice {

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

  /** 计量单位 */
  @Column({ name: 'unit', type: 'int', nullable: false, default: '0', comment: '计量单位' })
  unit: number;

  /** 零售价 */
  @Column({ name: 'market_sell_price', type: 'double', nullable: false, default: '0.0000', comment: '零售价' })
  marketSellPrice: number;

  /** 批发价 */
  @Column({ name: 'wholesale_price', type: 'double', nullable: false, default: '0.0000', comment: '批发价' })
  wholesalePrice: number;

  /** vip会员价 */
  @Column({ name: 'vip_price', type: 'double', nullable: false, default: '0.0000', comment: 'vip会员价' })
  vipPrice: number;

  /** 折扣率1 */
  @Column({ name: 'discount', type: 'double', nullable: true, default: '0.0000', comment: '折扣率1' })
  discount: number;

  /** 折扣率2 */
  @Column({ name: 'discount2', type: 'double', nullable: true, default: '0.0000', comment: '折扣率2' })
  discount2: number;

  /** 预计采购价 */
  @Column({ name: 'purchase', type: 'double', nullable: true, default: '0.0000', comment: '预计采购价' })
  purchase: number;

  /** 是否主单位:0=否,1=是 */
  @Column({ name: 'is_default', type: 'tinyint', nullable: false, default: '0', comment: '是否主单位:0=否,1=是' })
  isDefault: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;

  /** 删除时间 */
  @Column({ name: 'deletetime', type: 'bigint', nullable: true, comment: '删除时间' })
  deletetime: number;
}
