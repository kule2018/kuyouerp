import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_batch_exchange_info
 */
@Entity('kuyou_goods_batch_exchange_info')
export class GoodsBatchExchangeInfo {

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
  @Column({ name: 'attribute_id', type: 'varchar', length: 30, nullable: true, comment: '属性组合ID' })
  attributeId: string;

  /** 商品单位 */
  @Column({ name: 'goods_unit', type: 'int', nullable: true, comment: '商品单位' })
  goodsUnit: number;

  /** 仓库ID */
  @Column({ name: 'stores_id', type: 'int', nullable: false, default: '0', comment: '仓库ID' })
  storesId: number;

  /** 库存 */
  @Column({ name: 'stock', type: 'double', nullable: false, default: '0.0000', comment: '库存' })
  stock: number;

  /** 状态:0=关闭,1=正常 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: false, default: '1', comment: '状态:0=关闭,1=正常' })
  status: string;

  /** 期初数量 */
  @Column({ name: 'number', type: 'float', nullable: true, default: '0.0000', comment: '期初数量' })
  number: number;

  /** 批次 */
  @Column({ name: 'batch_name', type: 'varchar', length: 255, nullable: true, comment: '批次' })
  batchName: string;

  /** 生产日期 */
  @Column({ name: 'manufacture', type: 'int', nullable: true, comment: '生产日期' })
  manufacture: number;

  /** 保质期 */
  @Column({ name: 'guarantee', type: 'int', nullable: true, comment: '保质期' })
  guarantee: number;

  /** 有效期至 */
  @Column({ name: 'validity', type: 'int', nullable: true, comment: '有效期至' })
  validity: number;

  /** 购货单号 */
  @Column({ name: 'purchase_id', type: 'int', nullable: true, comment: '购货单号' })
  purchaseId: number;

  /** 购货单详情ID */
  @Column({ name: 'purchase_info_id', type: 'int', nullable: true, comment: '购货单详情ID' })
  purchaseInfoId: number;

  /** 类型:1=期初,2=购货 */
  @Column({ name: 'type', type: 'tinyint', nullable: true, default: '0', comment: '类型:1=期初,2=购货' })
  type: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
