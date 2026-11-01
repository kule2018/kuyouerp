import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_sales_order_info
 */
@Entity('kuyou_goods_sales_order_info')
export class GoodsSalesOrderInfo {

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

  /** 可生成购货单数量 */
  @Column({ name: 'purchase_number', type: 'double', nullable: true, default: '0.0000', comment: '可生成购货单数量' })
  purchaseNumber: number;

  /** 基本单位 */
  @Column({ name: 'default_unit', type: 'int', nullable: true, comment: '基本单位' })
  defaultUnit: number;

  /** 基本数量 */
  @Column({ name: 'basic_nmber', type: 'double', nullable: true, default: '0.0000', comment: '基本数量' })
  basicNmber: number;

  /** 购货单价 */
  @Column({ name: 'unit_price', type: 'double', nullable: true, default: '0.0000', comment: '购货单价' })
  unitPrice: number;

  /** 成本价 */
  @Column({ name: 'cost_price', type: 'double', nullable: true, comment: '成本价' })
  costPrice: number;

  /** 含税单价 */
  @Column({ name: 'tax_included', type: 'double', nullable: true, default: '0.0000', comment: '含税单价' })
  taxIncluded: number;

  /** 折扣率 */
  @Column({ name: 'discount', type: 'double', nullable: true, default: '0.0000', comment: '折扣率' })
  discount: number;

  /** 折扣额 */
  @Column({ name: 'dis_money', type: 'double', nullable: true, default: '0.0000', comment: '折扣额' })
  disMoney: number;

  /** 购货金额 */
  @Column({ name: 'all_money', type: 'double', nullable: true, default: '0.0000', comment: '购货金额' })
  allMoney: number;

  /** 税率 */
  @Column({ name: 'tax_rate', type: 'double', nullable: true, default: '0.0000', comment: '税率' })
  taxRate: number;

  /** 税额 */
  @Column({ name: 'tax_money', type: 'double', nullable: true, default: '0.0000', comment: '税额' })
  taxMoney: number;

  /** 价税合计 */
  @Column({ name: 'money_tax_price', type: 'double', nullable: true, default: '0.0000', comment: '价税合计' })
  moneyTaxPrice: number;

  /** 备注 */
  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark: string;

  /** 购货单号 */
  @Column({ name: 'purchase_id', type: 'varchar', length: 50, nullable: true, comment: '购货单号' })
  purchaseId: string;

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
  @Column({ name: 'preferential_money', type: 'float', nullable: true, default: '0.00', comment: '优惠额' })
  preferentialMoney: number;

  /** 优惠后金额 */
  @Column({ name: 'real_money', type: 'float', nullable: true, default: '0.00', comment: '优惠后金额' })
  realMoney: number;

  /** 采购费用 */
  @Column({ name: 'purchase_money', type: 'float', nullable: true, default: '0.00', comment: '采购费用' })
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
  @Column({ name: 'pay_money', type: 'float', nullable: true, default: '0.00', comment: '已付款金额' })
  payMoney: number;

  /** 付款账户 */
  @Column({ name: 'account', type: 'int', nullable: true, comment: '付款账户' })
  account: number;

  /** 打印次数 */
  @Column({ name: 'print_num', type: 'int', nullable: true, default: '0', comment: '打印次数' })
  printNum: number;

  /** 未入库数量 */
  @Column({ name: 'library_number', type: 'int', nullable: true, default: '0', comment: '未入库数量' })
  libraryNumber: number;

  /** 未入库金额 */
  @Column({ name: 'library_money', type: 'float', nullable: true, default: '0.00', comment: '未入库金额' })
  libraryMoney: number;

  /** 最后入库时间 */
  @Column({ name: 'library_time', type: 'bigint', nullable: true, comment: '最后入库时间' })
  libraryTime: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
