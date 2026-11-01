import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_sales_summary
 */
@Entity('kuyou_goods_sales_summary')
export class GoodsSalesSummary {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: true, comment: '单据编号' })
  purchaseCode: string;

  /** 类型:1=购货,2=退货 */
  @Column({ name: 'purchase_type', type: 'varchar', length: 255, nullable: true, default: '1', comment: '类型:1=购货,2=退货' })
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

  /** 商品编号 */
  @Column({ name: 'goods_code', type: 'varchar', length: 30, nullable: false, default: '', comment: '商品编号' })
  goodsCode: string;

  /** 商品备注 */
  @Column({ name: 'goods_note', type: 'varchar', length: 255, nullable: true, comment: '商品备注' })
  goodsNote: string;

  /** 商品属性 */
  @Column({ name: 'goods_attr', type: 'int', nullable: true, comment: '商品属性' })
  goodsAttr: number;

  /** 商品单位 */
  @Column({ name: 'goods_unit', type: 'int', nullable: true, comment: '商品单位' })
  goodsUnit: number;

  /** 仓库 */
  @Column({ name: 'stores_id', type: 'int', nullable: true, comment: '仓库' })
  storesId: number;

  /** 可用库存 */
  @Column({ name: 'allow_stock', type: 'double', nullable: true, default: '0.0000', comment: '可用库存' })
  allowStock: number;

  /** 数量 */
  @Column({ name: 'number', type: 'double', nullable: true, default: '0.0000', comment: '数量' })
  number: number;

  /** 基本单位 */
  @Column({ name: 'default_unit', type: 'int', nullable: true, comment: '基本单位' })
  defaultUnit: number;

  /** 基本数量 */
  @Column({ name: 'basic_nmber', type: 'double', nullable: true, default: '0.0000', comment: '基本数量' })
  basicNmber: number;

  /** 购货单价 */
  @Column({ name: 'unit_price', type: 'double', nullable: true, default: '0.0000', comment: '购货单价' })
  unitPrice: number;

  @Column({ name: 'cost_price', type: 'double', nullable: true })
  costPrice: number;

  /** 含税单价 */
  @Column({ name: 'tax_included', type: 'double', nullable: true, comment: '含税单价' })
  taxIncluded: number;

  /** 折扣率 */
  @Column({ name: 'discount', type: 'float', nullable: true, default: '0.00', comment: '折扣率' })
  discount: number;

  /** 折扣额 */
  @Column({ name: 'dis_money', type: 'double', nullable: true, default: '0.0000', comment: '折扣额' })
  disMoney: number;

  /** 购货金额 */
  @Column({ name: 'all_money', type: 'float', nullable: true, default: '0.0000', comment: '购货金额' })
  allMoney: number;

  /** 税率 */
  @Column({ name: 'tax_rate', type: 'double', nullable: true, default: '0.0000', comment: '税率' })
  taxRate: number;

  /** 税额 */
  @Column({ name: 'tax_money', type: 'double', nullable: true, default: '0.0000', comment: '税额' })
  taxMoney: number;

  /** 价税合计 */
  @Column({ name: 'money_tax_price', type: 'double', nullable: true, comment: '价税合计' })
  moneyTaxPrice: number;

  /** 备注 */
  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark: string;

  /** 销货订单号 */
  @Column({ name: 'purchase_order_id', type: 'varchar', length: 50, nullable: true, comment: '销货订单号' })
  purchaseOrderId: string;

  /** 销货单号 */
  @Column({ name: 'sales_order_id', type: 'varchar', length: 50, nullable: true, comment: '销货单号' })
  salesOrderId: string;

  /** 退货单号 */
  @Column({ name: 'returns_order_id', type: 'varchar', length: 50, nullable: true, comment: '退货单号' })
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

  /** 付款状态:0=未付款,1=部分付款,2=全部付款 */
  @Column({ name: 'pay_status', type: 'varchar', length: 255, nullable: true, default: '0', comment: '付款状态:0=未付款,1=部分付款,2=全部付款' })
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

  /** 打印次数 */
  @Column({ name: 'print_num', type: 'int', nullable: true, default: '0', comment: '打印次数' })
  printNum: number;

  @Column({ name: 'order_info_id', type: 'int', nullable: true })
  orderInfoId: number;

  /** 批次ID */
  @Column({ name: 'batch_id', type: 'int', nullable: true, comment: '批次ID' })
  batchId: number;

  /** 批次 */
  @Column({ name: 'batch_name', type: 'varchar', length: 100, nullable: true, comment: '批次' })
  batchName: string;

  /** 生产日期 */
  @Column({ name: 'manufacture', type: 'int', nullable: true, comment: '生产日期' })
  manufacture: number;

  /** 保质期 */
  @Column({ name: 'guarantee', type: 'int', nullable: true, comment: '保质期' })
  guarantee: number;

  /** 过期时间 */
  @Column({ name: 'validity', type: 'int', nullable: true, comment: '过期时间' })
  validity: number;

  /** 序列号 */
  @Column({ name: 'period', type: 'text', nullable: true, comment: '序列号' })
  period: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
