import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_batch_log
 */
@Entity('kuyou_goods_batch_log')
export class GoodsBatchLog {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 商品ID */
  @Column({ name: 'goods_id', type: 'int', nullable: false, default: '0', comment: '商品ID' })
  goodsId: number;

  /** 商品单价 */
  @Column({ name: 'unit_price', type: 'double', nullable: true, default: '0.0000', comment: '商品单价' })
  unitPrice: number;

  /** 含税单价 */
  @Column({ name: 'tax_included', type: 'double', nullable: true, default: '0.0000', comment: '含税单价' })
  taxIncluded: number;

  /** 金额 */
  @Column({ name: 'all_money', type: 'double', nullable: true, default: '0.0000', comment: '金额' })
  allMoney: number;

  /** 税额 */
  @Column({ name: 'tax_money', type: 'double', nullable: true, default: '0.0000', comment: '税额' })
  taxMoney: number;

  /** 价税合计 */
  @Column({ name: 'money_tax_price', type: 'double', nullable: true, default: '0.0000', comment: '价税合计' })
  moneyTaxPrice: number;

  /** 商品单位 */
  @Column({ name: 'goods_unit', type: 'int', nullable: true, comment: '商品单位' })
  goodsUnit: number;

  /** 仓库ID */
  @Column({ name: 'stores_id', type: 'int', nullable: true, comment: '仓库ID' })
  storesId: number;

  /** 批次ID */
  @Column({ name: 'batch_id', type: 'int', nullable: true, comment: '批次ID' })
  batchId: number;

  /** 数量 */
  @Column({ name: 'number', type: 'double', nullable: true, default: '0.0000', comment: '数量' })
  number: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: true, comment: '单据编号' })
  purchaseCode: string;

  /** 单据时间 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '单据时间' })
  purchaseTime: number;

  /** 业务类型:1=期初余额,2=普通采购,3=采购退回,4=普通销售,5=销售退回,6=调拨单,7=盘盈,8=其他入库,9=盘亏,10=其他出库,11=组合单,12=组合单,13=拆卸单,14=拆卸单,17=生产单,18=领料单,19=退料单,20=委外加工单 */
  @Column({ name: 'business_type', type: 'varchar', length: 255, nullable: true, comment: '业务类型:1=期初余额,2=普通采购,3=采购退回,4=普通销售,5=销售退回,6=调拨单,7=盘盈,8=其他入库,9=盘亏,10=其他出库,11=组合单,12=组合单,13=拆卸单,14=拆卸单,17=生产单,18=领料单,19=退料单,20=委外加工单' })
  businessType: string;

  /** 客户/供应商 */
  @Column({ name: 'customer_id', type: 'int', nullable: true, comment: '客户/供应商' })
  customerId: number;

  /** 销售人员 */
  @Column({ name: 'sale_id', type: 'int', nullable: true, comment: '销售人员' })
  saleId: number;

  /** 备注 */
  @Column({ name: 'remarks', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remarks: string;

  /** 来源关联ID */
  @Column({ name: 'order_id', type: 'int', nullable: true, comment: '来源关联ID' })
  orderId: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
