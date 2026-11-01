import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_sales_profit
 */
@Entity('kuyou_goods_sales_profit')
export class GoodsSalesProfit {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 单据日期 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '单据日期' })
  purchaseTime: number;

  /** 客户 */
  @Column({ name: 'customers_id', type: 'int', nullable: true, comment: '客户' })
  customersId: number;

  /** 销售员 */
  @Column({ name: 'sale_user', type: 'int', nullable: true, comment: '销售员' })
  saleUser: number;

  /** 制单人 */
  @Column({ name: 'preparation_id', type: 'int', nullable: true, comment: '制单人' })
  preparationId: number;

  /** 审核人 */
  @Column({ name: 'examine_id', type: 'int', nullable: true, comment: '审核人' })
  examineId: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: true, comment: '单据编号' })
  purchaseCode: string;

  /** 业务类别:1=普通销售,2=销售退货 */
  @Column({ name: 'purchase_type', type: 'varchar', length: 255, nullable: true, comment: '业务类别:1=普通销售,2=销售退货' })
  purchaseType: string;

  /** 数量 */
  @Column({ name: 'number', type: 'double', nullable: true, comment: '数量' })
  number: number;

  /** 折扣额 */
  @Column({ name: 'amount', type: 'double', nullable: true, comment: '折扣额' })
  amount: number;

  /** 销售收入 */
  @Column({ name: 'all_money', type: 'varchar', length: 255, nullable: true, comment: '销售收入' })
  allMoney: string;

  /** 税额 */
  @Column({ name: 'tax_money', type: 'double', nullable: true, comment: '税额' })
  taxMoney: number;

  /** 价税合计 */
  @Column({ name: 'money_tax_price', type: 'double', nullable: true, comment: '价税合计' })
  moneyTaxPrice: number;

  /** 销售成本 */
  @Column({ name: 'sales_cost', type: 'double', nullable: true, comment: '销售成本' })
  salesCost: number;

  /** 优惠额 */
  @Column({ name: 'preferential_money', type: 'double', nullable: true, comment: '优惠额' })
  preferentialMoney: number;

  /** 销售费用 */
  @Column({ name: 'purchase_money', type: 'double', nullable: true, comment: '销售费用' })
  purchaseMoney: number;

  /** 优惠后金额 */
  @Column({ name: 'real_money', type: 'double', nullable: true, comment: '优惠后金额' })
  realMoney: number;

  /** 客户承担费用 */
  @Column({ name: 'customers_money', type: 'double', nullable: true, comment: '客户承担费用' })
  customersMoney: number;

  /** 应收金额 */
  @Column({ name: 'need_money', type: 'double', nullable: true, comment: '应收金额' })
  needMoney: number;

  /** 已收款金额 */
  @Column({ name: 'pay_money', type: 'double', nullable: true, comment: '已收款金额' })
  payMoney: number;

  /** 整单备注 */
  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '整单备注' })
  remark: string;
}
