import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_warehouse
 */
@Entity('kuyou_warehouse')
export class Warehouse {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: true, comment: '单据编号' })
  purchaseCode: string;

  /** 单据时间 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '单据时间' })
  purchaseTime: number;

  /** 业务类别:1=盘亏,2=其他出库 */
  @Column({ name: 'business_type', type: 'varchar', length: 255, nullable: true, comment: '业务类别:1=盘亏,2=其他出库' })
  businessType: string;

  /** 数量 */
  @Column({ name: 'number', type: 'double', nullable: true, comment: '数量' })
  number: number;

  /** 金额 */
  @Column({ name: 'price', type: 'double', nullable: true, comment: '金额' })
  price: number;

  /** 客户 */
  @Column({ name: 'customers_id', type: 'int', nullable: true, comment: '客户' })
  customersId: number;

  /** 制单人 */
  @Column({ name: 'preparation_id', type: 'int', nullable: true, comment: '制单人' })
  preparationId: number;

  /** 审核人 */
  @Column({ name: 'examine_id', type: 'int', nullable: true, comment: '审核人' })
  examineId: number;

  /** 最后操作人 */
  @Column({ name: 'operation_id', type: 'int', nullable: true, comment: '最后操作人' })
  operationId: number;

  /** 审核时间 */
  @Column({ name: 'examine_time', type: 'bigint', nullable: true, comment: '审核时间' })
  examineTime: number;

  /** 审核状态:0=未审核,1=已审核 */
  @Column({ name: 'examine_status', type: 'varchar', length: 255, nullable: false, default: '0', comment: '审核状态:0=未审核,1=已审核' })
  examineStatus: string;

  /** 备注 */
  @Column({ name: 'remarks', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remarks: string;

  /** 打印次数 */
  @Column({ name: 'print_num', type: 'int', nullable: true, comment: '打印次数' })
  printNum: number;

  /** 盘点单ID */
  @Column({ name: 'order_id', type: 'int', nullable: true, comment: '盘点单ID' })
  orderId: number;

  /** 单据类型:1=盘点,2=序列号盘点 */
  @Column({ name: 'order_type', type: 'varchar', length: 255, nullable: true, comment: '单据类型:1=盘点,2=序列号盘点' })
  orderType: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
