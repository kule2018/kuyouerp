import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_acceptance_info
 */
@Entity('kuyou_acceptance_info')
export class AcceptanceInfo {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 类型:1=原材料,2=商品 */
  @Column({ name: 'type', type: 'varchar', length: 255, nullable: true, default: '1', comment: '类型:1=原材料,2=商品' })
  type: string;

  /** 生产ID */
  @Column({ name: 'production_id', type: 'int', nullable: true, comment: '生产ID' })
  productionId: number;

  /** 商品ID */
  @Column({ name: 'goods_id', type: 'int', nullable: true, comment: '商品ID' })
  goodsId: number;

  /** 商品编号 */
  @Column({ name: 'goods_code', type: 'varchar', length: 255, nullable: true, comment: '商品编号' })
  goodsCode: string;

  /** 商品名称 */
  @Column({ name: 'goods_name', type: 'varchar', length: 255, nullable: true, comment: '商品名称' })
  goodsName: string;

  /** 商品规格型号 */
  @Column({ name: 'goods_note', type: 'varchar', length: 255, nullable: true, comment: '商品规格型号' })
  goodsNote: string;

  /** 单位ID */
  @Column({ name: 'unit_id', type: 'int', nullable: true, comment: '单位ID' })
  unitId: number;

  /** 默认单位 */
  @Column({ name: 'default_unit', type: 'int', nullable: true, comment: '默认单位' })
  defaultUnit: number;

  /** 进价 */
  @Column({ name: 'purchase', type: 'double', nullable: true, default: '0.0000', comment: '进价' })
  purchase: number;

  /** 生产数量 */
  @Column({ name: 'need_number', type: 'double', nullable: true, default: '0.0000', comment: '生产数量' })
  needNumber: number;

  /** 验收数量 */
  @Column({ name: 'number', type: 'double', nullable: true, default: '0.0000', comment: '验收数量' })
  number: number;

  /** 不合格数量 */
  @Column({ name: 'bad_number', type: 'double', nullable: true, default: '0.0000', comment: '不合格数量' })
  badNumber: number;

  /** 基本数量 */
  @Column({ name: 'basic_nmber', type: 'double', nullable: true, comment: '基本数量' })
  basicNmber: number;

  /** 金额 */
  @Column({ name: 'money', type: 'double', nullable: true, comment: '金额' })
  money: number;

  /** 备注 */
  @Column({ name: 'remark', type: 'text', nullable: true, comment: '备注' })
  remark: string;

  /** 仓库 */
  @Column({ name: 'stores_id', type: 'int', nullable: true, comment: '仓库' })
  storesId: number;

  /** 可用库存 */
  @Column({ name: 'allow_stock', type: 'double', nullable: true, default: '0.0000', comment: '可用库存' })
  allowStock: number;

  /** 商品属性 */
  @Column({ name: 'goods_attr', type: 'int', nullable: true, comment: '商品属性' })
  goodsAttr: number;

  /** 批次ID */
  @Column({ name: 'batch_id', type: 'int', nullable: true, comment: '批次ID' })
  batchId: number;

  /** 批次名称 */
  @Column({ name: 'batch_name', type: 'varchar', length: 100, nullable: true, comment: '批次名称' })
  batchName: string;

  /** 生产日期 */
  @Column({ name: 'manufacture', type: 'int', nullable: true, comment: '生产日期' })
  manufacture: number;

  /** 保质期 */
  @Column({ name: 'guarantee', type: 'int', nullable: true, comment: '保质期' })
  guarantee: number;

  /** 到期时间 */
  @Column({ name: 'validity', type: 'int', nullable: true, comment: '到期时间' })
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
