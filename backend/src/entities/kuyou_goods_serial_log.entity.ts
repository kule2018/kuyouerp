import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_serial_log
 */
@Entity('kuyou_goods_serial_log')
export class GoodsSerialLog {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 商品ID */
  @Column({ name: 'goods_id', type: 'int', nullable: true, comment: '商品ID' })
  goodsId: number;

  /** 仓库ID */
  @Column({ name: 'stores_id', type: 'int', nullable: true, comment: '仓库ID' })
  storesId: number;

  /** 属性组合 */
  @Column({ name: 'attribute_id', type: 'int', nullable: true, comment: '属性组合' })
  attributeId: number;

  /** 序列号 */
  @Column({ name: 'serial', type: 'varchar', length: 30, nullable: true, comment: '序列号' })
  serial: string;

  /** 业务类型:1=期初,2=普通采购,3=采购退回,4=普通销售,5=销售退回,6=调拨单,,7=盘盈,8=其他入库,9=盘亏,10=其他出库,11=组合单,12=组合单,13=拆卸单,14=拆卸单,17=生产单,18=领料单,19=退料单,20=委外加工单 */
  @Column({ name: 'business_type', type: 'varchar', length: 255, nullable: true, comment: '业务类型:1=期初,2=普通采购,3=采购退回,4=普通销售,5=销售退回,6=调拨单,,7=盘盈,8=其他入库,9=盘亏,10=其他出库,11=组合单,12=组合单,13=拆卸单,14=拆卸单,17=生产单,18=领料单,19=退料单,20=委外加工单' })
  businessType: string;

  /** 在库状态:0=未入库,1=在库,2=出库 */
  @Column({ name: 'store_status', type: 'varchar', length: 255, nullable: true, default: '0', comment: '在库状态:0=未入库,1=在库,2=出库' })
  storeStatus: string;

  /** 备注 */
  @Column({ name: 'remarks', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remarks: string;

  /** 单据ID */
  @Column({ name: 'purchase_id', type: 'int', nullable: true, comment: '单据ID' })
  purchaseId: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 30, nullable: true, comment: '单据编号' })
  purchaseCode: string;

  /** 单据时间 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '单据时间' })
  purchaseTime: number;

  /** 往来单位 */
  @Column({ name: 'customer_id', type: 'int', nullable: true, comment: '往来单位' })
  customerId: number;

  /** 来源ID */
  @Column({ name: 'order_id', type: 'int', nullable: true, comment: '来源ID' })
  orderId: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
