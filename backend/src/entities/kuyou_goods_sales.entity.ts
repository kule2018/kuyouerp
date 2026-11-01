import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_sales
 */
@Entity('kuyou_goods_sales')
export class GoodsSales {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: true, comment: '单据编号' })
  purchaseCode: string;

  /** 零售编号 */
  @Column({ name: 'order_code', type: 'varchar', length: 50, nullable: true, comment: '零售编号' })
  orderCode: string;

  /** 零售时间 */
  @Column({ name: 'order_time', type: 'bigint', nullable: true, comment: '零售时间' })
  orderTime: number;

  /** 单据类型:1=销货单,2=零售单 */
  @Column({ name: 'order_type', type: 'varchar', length: 255, nullable: true, default: '1', comment: '单据类型:1=销货单,2=零售单' })
  orderType: string;

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

  /** 销货金额 */
  @Column({ name: 'all_money', type: 'float', nullable: true, default: '0.0000', comment: '销货金额' })
  allMoney: number;

  /** 购货订单号 */
  @Column({ name: 'purchase_order_id', type: 'varchar', length: 50, nullable: true, comment: '购货订单号' })
  purchaseOrderId: string;

  /** 销货订单号 */
  @Column({ name: 'sales_order_id', type: 'varchar', length: 50, nullable: true, comment: '销货订单号' })
  salesOrderId: string;

  /** 退货订单号 */
  @Column({ name: 'returns_order_id', type: 'varchar', length: 50, nullable: true, comment: '退货订单号' })
  returnsOrderId: string;

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

  /** 客户承担费用 */
  @Column({ name: 'customers_money', type: 'double', nullable: true, default: '0.0000', comment: '客户承担费用' })
  customersMoney: number;

  /** 制单人 */
  @Column({ name: 'preparation_id', type: 'int', nullable: true, comment: '制单人' })
  preparationId: number;

  /** 审核人 */
  @Column({ name: 'examine_id', type: 'int', nullable: true, comment: '审核人' })
  examineId: number;

  /** 最后操作人 */
  @Column({ name: 'operation_id', type: 'int', nullable: true, comment: '最后操作人' })
  operationId: number;

  /** 收款状态:0=未收款,1=全部收款,2=部分收款 */
  @Column({ name: 'pay_status', type: 'varchar', length: 255, nullable: true, default: '0', comment: '收款状态:0=未收款,1=全部收款,2=部分收款' })
  payStatus: string;

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

  /** 采购销售费用 */
  @Column({ name: 'cost_data', type: 'text', nullable: true, comment: '采购销售费用' })
  costData: string;

  /** 三方ID */
  @Column({ name: 'third_id', type: 'int', nullable: true, default: 0, comment: '三方ID' })
  thirdId: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
