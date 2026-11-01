import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_log
 */
@Entity('kuyou_goods_log')
export class GoodsLog {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: true, comment: '单据编号' })
  purchaseCode: string;

  /** 单据ID */
  @Column({ name: 'purchase_id', type: 'int', nullable: true, comment: '单据ID' })
  purchaseId: number;

  /** 单据日期 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '单据日期' })
  purchaseTime: number;

  /** 业务类型:1=期初余额,2=普通采购,3=采购退回,4=普通销售,5=销售退回,6=调拨单,7=成本调整,8=盘盈,9=其他入库,10=盘亏,11=其他出库,12=组装单,13组装单,14=拆卸单,15=拆卸单,17=生产单,18=领料单,19=退料单,20=委外加工单 */
  @Column({ name: 'business_type', type: 'varchar', length: 255, nullable: false, default: '1', comment: '业务类型:1=期初余额,2=普通采购,3=采购退回,4=普通销售,5=销售退回,6=调拨单,7=成本调整,8=盘盈,9=其他入库,10=盘亏,11=其他出库,12=组装单,13组装单,14=拆卸单,15=拆卸单,17=生产单,18=领料单,19=退料单,20=委外加工单' })
  businessType: string;

  /** 往来单位 */
  @Column({ name: 'customer_id', type: 'int', nullable: true, comment: '往来单位' })
  customerId: number;

  /** 商品ID */
  @Column({ name: 'goods_id', type: 'int', nullable: false, default: '0', comment: '商品ID' })
  goodsId: number;

  /** 商品编号 */
  @Column({ name: 'goods_code', type: 'varchar', length: 30, nullable: true, comment: '商品编号' })
  goodsCode: string;

  /** 属性组合ID */
  @Column({ name: 'attribute_id', type: 'int', nullable: true, comment: '属性组合ID' })
  attributeId: number;

  /** 商品单位 */
  @Column({ name: 'goods_unit', type: 'int', nullable: true, comment: '商品单位' })
  goodsUnit: number;

  /** 备注 */
  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark: string;

  /** 仓库ID */
  @Column({ name: 'stores_id', type: 'int', nullable: true, default: '0', comment: '仓库ID' })
  storesId: number;

  /** 入库数量 */
  @Column({ name: 'enter_number', type: 'double', nullable: true, comment: '入库数量' })
  enterNumber: number;

  /** 基本单位数量 */
  @Column({ name: 'enter_basics', type: 'double', nullable: true, comment: '基本单位数量' })
  enterBasics: number;

  /** 单位成本 */
  @Column({ name: 'enter_unit', type: 'double', nullable: true, comment: '单位成本' })
  enterUnit: number;

  /** 成本 */
  @Column({ name: 'enter_cost', type: 'double', nullable: true, comment: '成本' })
  enterCost: number;

  /** 出库数量 */
  @Column({ name: 'out_number', type: 'double', nullable: true, comment: '出库数量' })
  outNumber: number;

  /** 基本单位数量 */
  @Column({ name: 'out_basics', type: 'double', nullable: true, comment: '基本单位数量' })
  outBasics: number;

  /** 单位成本 */
  @Column({ name: 'out_unit', type: 'double', nullable: true, comment: '单位成本' })
  outUnit: number;

  /** 成本 */
  @Column({ name: 'out_cost', type: 'double', nullable: true, comment: '成本' })
  outCost: number;

  /** 基本单位数量 */
  @Column({ name: 'balance_basics', type: 'double', nullable: true, comment: '基本单位数量' })
  balanceBasics: number;

  /** 单位成本 */
  @Column({ name: 'balance_unit', type: 'double', nullable: true, comment: '单位成本' })
  balanceUnit: number;

  /** 成本 */
  @Column({ name: 'balance_cost', type: 'double', nullable: true, comment: '成本' })
  balanceCost: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
