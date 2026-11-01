import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_sales_order
 */
@Entity('kuyou_goods_sales_order')
export class GoodsSalesOrder {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: true, comment: '单据编号' })
  purchaseCode: string;

  /** 类型:1=销货,2=退货 */
  @Column({ name: 'purchase_type', type: 'varchar', length: 255, nullable: true, default: '1', comment: '类型:1=销货,2=退货' })
  purchaseType: string;

  /** 单据日期 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '单据日期' })
  purchaseTime: number;

  /** 交货时间 */
  @Column({ name: 'delivery_time', type: 'bigint', nullable: true, comment: '交货时间' })
  deliveryTime: number;

  /** 客户 */
  @Column({ name: 'customers_id', type: 'int', nullable: true, comment: '客户' })
  customersId: number;

  /** 收货地址 */
  @Column({ name: 'receiving_address', type: 'varchar', length: 255, nullable: true, comment: '收货地址' })
  receivingAddress: string;

  /** 销售员 */
  @Column({ name: 'sale_user', type: 'int', nullable: true, comment: '销售员' })
  saleUser: number;

  /** 数量 */
  @Column({ name: 'number', type: 'double', nullable: true, default: '0.0000', comment: '数量' })
  number: number;

  /** 购货金额 */
  @Column({ name: 'all_money', type: 'double', nullable: true, default: '0.0000', comment: '购货金额' })
  allMoney: number;

  /** 销货单号 */
  @Column({ name: 'purchase_id', type: 'varchar', length: 50, nullable: true, comment: '销货单号' })
  purchaseId: string;

  /** 销货订单号 */
  @Column({ name: 'sales_order_id', type: 'varchar', length: 50, nullable: true, comment: '销货订单号' })
  salesOrderId: string;

  /** 退货订单号 */
  @Column({ name: 'returns_order_id', type: 'varchar', length: 50, nullable: true, comment: '退货订单号' })
  returnsOrderId: string;

  /** 折扣 */
  @Column({ name: 'discount', type: 'float', nullable: true, default: '10.00', comment: '折扣' })
  discount: number;

  /** 优惠率 */
  @Column({ name: 'preferential_rate', type: 'float', nullable: true, default: '0.00', comment: '优惠率' })
  preferentialRate: number;

  /** 优惠额 */
  @Column({ name: 'preferential_money', type: 'double', nullable: true, default: '0.0000', comment: '优惠额' })
  preferentialMoney: number;

  /** 优惠后金额 */
  @Column({ name: 'real_money', type: 'double', nullable: true, default: '0.0000', comment: '优惠后金额' })
  realMoney: number;

  /** 税额 */
  @Column({ name: 'tax_money', type: 'double', nullable: true, comment: '税额' })
  taxMoney: number;

  /** 价税合计 */
  @Column({ name: 'money_tax_price', type: 'double', nullable: true, default: '0.0000', comment: '价税合计' })
  moneyTaxPrice: number;

  /** 采购费用 */
  @Column({ name: 'purchase_money', type: 'double', nullable: true, default: '0.0000', comment: '采购费用' })
  purchaseMoney: number;

  /** 制单人 */
  @Column({ name: 'preparation_id', type: 'int', nullable: true, comment: '制单人' })
  preparationId: number;

  /** 审核人 */
  @Column({ name: 'examine_id', type: 'int', nullable: true, comment: '审核人' })
  examineId: number;

  /** 最后操作人 */
  @Column({ name: 'operation_id', type: 'int', nullable: true, comment: '最后操作人' })
  operationId: number;

  /** 状态:0=未出库,1=全部出库,2=部分出库,3=已取消 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: true, default: '0', comment: '状态:0=未出库,1=全部出库,2=部分出库,3=已取消' })
  status: string;

  /** 对单状态:0=未对单,1=已对单 */
  @Column({ name: 'check_status', type: 'varchar', length: 255, nullable: true, default: '0', comment: '对单状态:0=未对单,1=已对单' })
  checkStatus: string;

  /** 审核状态:0=未审核,1=已审核 */
  @Column({ name: 'examine_status', type: 'varchar', length: 255, nullable: true, default: '0', comment: '审核状态:0=未审核,1=已审核' })
  examineStatus: string;

  /** 审核时间 */
  @Column({ name: 'examine_time', type: 'bigint', nullable: true, comment: '审核时间' })
  examineTime: number;

  /** 已付款金额 */
  @Column({ name: 'pay_money', type: 'double', nullable: true, default: '0.0000', comment: '已付款金额' })
  payMoney: number;

  /** 入库数量 */
  @Column({ name: 'store_number', type: 'double', nullable: true, default: '0.0000', comment: '入库数量' })
  storeNumber: number;

  /** 付款账户 */
  @Column({ name: 'account', type: 'int', nullable: true, comment: '付款账户' })
  account: number;

  /** 备注 */
  @Column({ name: 'note', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  note: string;

  /** 本次欠款 */
  @Column({ name: 'arrears', type: 'double', nullable: true, default: '0.0000', comment: '本次欠款' })
  arrears: number;

  /** 总欠款 */
  @Column({ name: 'all_arrears', type: 'double', nullable: true, default: '0.0000', comment: '总欠款' })
  allArrears: number;

  /** 打印次数 */
  @Column({ name: 'print_num', type: 'int', nullable: true, default: '0', comment: '打印次数' })
  printNum: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
