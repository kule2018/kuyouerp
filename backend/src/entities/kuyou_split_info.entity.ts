import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_split_info
 */
@Entity('kuyou_split_info')
export class SplitInfo {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: false, default: '', comment: '单据编号' })
  purchaseCode: string;

  /** 单据日期 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '单据日期' })
  purchaseTime: number;

  /** 类型:1=拆卸单 */
  @Column({ name: 'business_type', type: 'varchar', length: 255, nullable: false, default: '1', comment: '类型:1=拆卸单' })
  businessType: string;

  /** 类型:1=组合件,2=子件 */
  @Column({ name: 'type', type: 'varchar', length: 255, nullable: false, default: '2', comment: '类型:1=组合件,2=子件' })
  type: string;

  /** 商品ID */
  @Column({ name: 'goods_id', type: 'int', nullable: false, default: '0', comment: '商品ID' })
  goodsId: number;

  /** 商品编号 */
  @Column({ name: 'goods_code', type: 'varchar', length: 50, nullable: false, default: '', comment: '商品编号' })
  goodsCode: string;

  /** 商品属性 */
  @Column({ name: 'goods_attr', type: 'int', nullable: true, comment: '商品属性' })
  goodsAttr: number;

  /** 商品单位 */
  @Column({ name: 'goods_unit', type: 'int', nullable: false, default: '0', comment: '商品单位' })
  goodsUnit: number;

  /** 仓库 */
  @Column({ name: 'stores_id', type: 'int', nullable: false, default: '0', comment: '仓库' })
  storesId: number;

  /** 可用库存 */
  @Column({ name: 'allow_stock', type: 'double', nullable: true, default: '0.0000', comment: '可用库存' })
  allowStock: number;

  /** 数量 */
  @Column({ name: 'number', type: 'double', nullable: true, default: '0.0000', comment: '数量' })
  number: number;

  /** 序列号 */
  @Column({ name: 'period', type: 'text', nullable: true, comment: '序列号' })
  period: string;

  /** 基本数量 */
  @Column({ name: 'basic_number', type: 'double', nullable: true, default: '0.0000', comment: '基本数量' })
  basicNumber: number;

  /** 单位成本 */
  @Column({ name: 'unit_cost', type: 'double', nullable: true, default: '0', comment: '单位成本' })
  unitCost: number;

  /** 成本 */
  @Column({ name: 'cost_money', type: 'double', nullable: true, default: '0', comment: '成本' })
  costMoney: number;

  /** 备注 */
  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark: string;

  /** 批次ID */
  @Column({ name: 'batch_id', type: 'int', nullable: true, comment: '批次ID' })
  batchId: number;

  /** 批次 */
  @Column({ name: 'batch', type: 'varchar', length: 255, nullable: true, comment: '批次' })
  batch: string;

  /** 生产日期 */
  @Column({ name: 'manufacture', type: 'int', nullable: true, comment: '生产日期' })
  manufacture: number;

  /** 保质期 */
  @Column({ name: 'guarantee', type: 'int', nullable: true, comment: '保质期' })
  guarantee: number;

  /** 过期时间 */
  @Column({ name: 'validity', type: 'int', nullable: true, comment: '过期时间' })
  validity: number;

  /** 制单人 */
  @Column({ name: 'preparation_id', type: 'int', nullable: true, comment: '制单人' })
  preparationId: number;

  /** 最后操作人 */
  @Column({ name: 'operation_id', type: 'int', nullable: true, comment: '最后操作人' })
  operationId: number;

  /** 审核人 */
  @Column({ name: 'examine_id', type: 'int', nullable: true, comment: '审核人' })
  examineId: number;

  /** 审核状态:0=未审核,1=已审核 */
  @Column({ name: 'examine_status', type: 'varchar', length: 255, nullable: true, default: '0', comment: '审核状态:0=未审核,1=已审核' })
  examineStatus: string;

  /** 审核时间 */
  @Column({ name: 'examine_time', type: 'bigint', nullable: true, comment: '审核时间' })
  examineTime: number;

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
