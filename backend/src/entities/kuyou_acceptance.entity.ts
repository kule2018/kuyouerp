import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_acceptance
 */
@Entity('kuyou_acceptance')
export class Acceptance {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 验收类型:1=加工单,2=委外加工单 */
  @Column({ name: 'code_type', type: 'varchar', length: 255, nullable: true, default: '1', comment: '验收类型:1=加工单,2=委外加工单' })
  codeType: string;

  /** 加工单单号 */
  @Column({ name: 'chase_code', type: 'varchar', length: 50, nullable: true, comment: '加工单单号' })
  chaseCode: string;

  /** 生产单号 */
  @Column({ name: 'production_code', type: 'varchar', length: 50, nullable: true, comment: '生产单号' })
  productionCode: string;

  /** 委外加工单单号 */
  @Column({ name: 'outsourcing_code', type: 'varchar', length: 50, nullable: true, comment: '委外加工单单号' })
  outsourcingCode: string;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: true, comment: '单据编号' })
  purchaseCode: string;

  /** 单据日期 */
  @Column({ name: 'purchase_time', type: 'varchar', length: 50, nullable: true, comment: '单据日期' })
  purchaseTime: string;

  /** 交货时间 */
  @Column({ name: 'delivery_time', type: 'bigint', nullable: true, comment: '交货时间' })
  deliveryTime: number;

  /** 车间 */
  @Column({ name: 'workshop_id', type: 'int', nullable: true, comment: '车间' })
  workshopId: number;

  /** 生产工人 */
  @Column({ name: 'work_id', type: 'int', nullable: true, comment: '生产工人' })
  workId: number;

  /** 商品名称 */
  @Column({ name: 'goods_name', type: 'varchar', length: 255, nullable: true, comment: '商品名称' })
  goodsName: string;

  /** 商品编号 */
  @Column({ name: 'goods_code', type: 'varchar', length: 100, nullable: true, comment: '商品编号' })
  goodsCode: string;

  /** 商品单位 */
  @Column({ name: 'goods_unit', type: 'int', nullable: true, comment: '商品单位' })
  goodsUnit: number;

  /** 基本单位 */
  @Column({ name: 'default_unit', type: 'int', nullable: true, comment: '基本单位' })
  defaultUnit: number;

  /** 数量 */
  @Column({ name: 'number', type: 'double', nullable: true, comment: '数量' })
  number: number;

  /** 完成数量 */
  @Column({ name: 'finish_number', type: 'double', nullable: true, comment: '完成数量' })
  finishNumber: number;

  /** 基本数量 */
  @Column({ name: 'basic_nmber', type: 'double', nullable: true, comment: '基本数量' })
  basicNmber: number;

  /** 单价 */
  @Column({ name: 'unit_price', type: 'double', nullable: true, comment: '单价' })
  unitPrice: number;

  /** 金额 */
  @Column({ name: 'all_money', type: 'float', nullable: true, comment: '金额' })
  allMoney: number;

  /** 审核状态:0=未审核,1=已审核 */
  @Column({ name: 'examine_status', type: 'varchar', length: 255, nullable: true, default: '0', comment: '审核状态:0=未审核,1=已审核' })
  examineStatus: string;

  /** 审核时间 */
  @Column({ name: 'examine_time', type: 'bigint', nullable: true, comment: '审核时间' })
  examineTime: number;

  /** 状态:0=未完成,1=已完成 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: true, default: '0', comment: '状态:0=未完成,1=已完成' })
  status: string;

  /** 备注 */
  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark: string;

  /** 制单人 */
  @Column({ name: 'preparation_id', type: 'int', nullable: true, comment: '制单人' })
  preparationId: number;

  /** 审核人 */
  @Column({ name: 'examine_id', type: 'int', nullable: true, comment: '审核人' })
  examineId: number;

  /** 最后操作人 */
  @Column({ name: 'operation_id', type: 'int', nullable: true, comment: '最后操作人' })
  operationId: number;

  /** mrp状态 */
  @Column({ name: 'mrp_status', type: 'varchar', length: 255, nullable: true, default: '0', comment: 'mrp状态' })
  mrpStatus: string;

  /** 开工时间 */
  @Column({ name: 'work_time', type: 'bigint', nullable: true, comment: '开工时间' })
  workTime: number;

  /** 完工时间 */
  @Column({ name: 'finish_time', type: 'bigint', nullable: true, comment: '完工时间' })
  finishTime: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
