import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_serial
 */
@Entity('kuyou_goods_serial')
export class GoodsSerial {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 商品ID */
  @Column({ name: 'goods_id', type: 'int', nullable: true, comment: '商品ID' })
  goodsId: number;

  /** 商品编号 */
  @Column({ name: 'goods_code', type: 'varchar', length: 30, nullable: true, comment: '商品编号' })
  goodsCode: string;

  /** 仓库ID */
  @Column({ name: 'stores_id', type: 'int', nullable: true, comment: '仓库ID' })
  storesId: number;

  /** 属性组合 */
  @Column({ name: 'attribute_id', type: 'varchar', length: 255, nullable: true, comment: '属性组合' })
  attributeId: string;

  /** 序列号 */
  @Column({ name: 'serial', type: 'varchar', length: 30, nullable: true, comment: '序列号' })
  serial: string;

  /** 状态:1=购货,2=购货退货,3=销货,4=销货退货,5=盘点,6=其他,7=盘盈,8=其他入库,9=盘亏,10=其他出库,11=组合单,12=组合单,13=拆卸单,14=拆卸单,15=生产 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: true, default: '1', comment: '状态:1=购货,2=购货退货,3=销货,4=销货退货,5=盘点,6=其他,7=盘盈,8=其他入库,9=盘亏,10=其他出库,11=组合单,12=组合单,13=拆卸单,14=拆卸单,15=生产' })
  status: string;

  /** 在库状态:0=未入库,1=在库,2=出库 */
  @Column({ name: 'store_status', type: 'varchar', length: 255, nullable: true, default: '0', comment: '在库状态:0=未入库,1=在库,2=出库' })
  storeStatus: string;

  /** 备注 */
  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark: string;

  /** 购货单ID */
  @Column({ name: 'purchase_id', type: 'int', nullable: true, comment: '购货单ID' })
  purchaseId: number;

  /** 购货单单号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 30, nullable: true, comment: '购货单单号' })
  purchaseCode: string;

  /** 购货退货单ID */
  @Column({ name: 'purchase_exchange_id', type: 'int', nullable: true, comment: '购货退货单ID' })
  purchaseExchangeId: number;

  /** 购货退货单单号 */
  @Column({ name: 'purchase_exchange_code', type: 'varchar', length: 30, nullable: true, comment: '购货退货单单号' })
  purchaseExchangeCode: string;

  /** 销货单ID */
  @Column({ name: 'sale_id', type: 'int', nullable: true, comment: '销货单ID' })
  saleId: number;

  /** 销货单号 */
  @Column({ name: 'sale_code', type: 'varchar', length: 30, nullable: true, comment: '销货单号' })
  saleCode: string;

  /** 销货退货单ID */
  @Column({ name: 'sale_exchange_id', type: 'int', nullable: true, comment: '销货退货单ID' })
  saleExchangeId: number;

  /** 销货退货单单号 */
  @Column({ name: 'sale_exchange_code', type: 'varchar', length: 30, nullable: true, comment: '销货退货单单号' })
  saleExchangeCode: string;

  /** 来源ID */
  @Column({ name: 'order_id', type: 'int', nullable: true, comment: '来源ID' })
  orderId: number;

  /** 入库单ID */
  @Column({ name: 'warehousing_id', type: 'int', nullable: true, comment: '入库单ID' })
  warehousingId: number;

  /** 是否其他入库:1=否,2=是 */
  @Column({ name: 'warehousing_status', type: 'varchar', length: 255, nullable: true, default: '1', comment: '是否其他入库:1=否,2=是' })
  warehousingStatus: string;

  /** 出库单ID */
  @Column({ name: 'warehoue_id', type: 'int', nullable: true, comment: '出库单ID' })
  warehoueId: number;

  /** 组合单ID */
  @Column({ name: 'assemble_id', type: 'int', nullable: true, comment: '组合单ID' })
  assembleId: number;

  /** 组装单入库 */
  @Column({ name: 'assemble_status', type: 'varchar', length: 255, nullable: true, default: '2', comment: '组装单入库' })
  assembleStatus: string;

  /** 拆卸单ID */
  @Column({ name: 'split_id', type: 'int', nullable: true, comment: '拆卸单ID' })
  splitId: number;

  /** 拆卸单入库 */
  @Column({ name: 'split_status', type: 'varchar', length: 255, nullable: true, default: '2', comment: '拆卸单入库' })
  splitStatus: string;

  @Column({ name: 'old_status', type: 'int', nullable: true })
  oldStatus: number;

  @Column({ name: 'old_store', type: 'int', nullable: true })
  oldStore: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
