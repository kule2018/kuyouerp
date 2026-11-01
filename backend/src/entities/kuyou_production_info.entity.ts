import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_production_info
 */
@Entity('kuyou_production_info')
export class ProductionInfo {

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

  /** 数量 */
  @Column({ name: 'number', type: 'double', nullable: true, default: '0.0000', comment: '数量' })
  number: number;

  /** 基本数量 */
  @Column({ name: 'basic_nmber', type: 'double', nullable: true, comment: '基本数量' })
  basicNmber: number;

  /** 金额 */
  @Column({ name: 'money', type: 'double', nullable: true, comment: '金额' })
  money: number;

  /** 备注 */
  @Column({ name: 'remark', type: 'text', nullable: true, comment: '备注' })
  remark: string;

  /** 库存总数量 */
  @Column({ name: 'stock_number', type: 'double', nullable: true, default: '0.0000', comment: '库存总数量' })
  stockNumber: number;

  /** 需求数量 */
  @Column({ name: 'need_number', type: 'double', nullable: true, default: '0.0000', comment: '需求数量' })
  needNumber: number;

  /** 领用数量 */
  @Column({ name: 'requisition_number', type: 'double', nullable: true, default: '0.0000', comment: '领用数量' })
  requisitionNumber: number;

  /** 使用数量 */
  @Column({ name: 'use_number', type: 'double', nullable: true, default: '0.0000', comment: '使用数量' })
  useNumber: number;

  /** 退料数量 */
  @Column({ name: 'back_number', type: 'double', nullable: true, default: '0.0000', comment: '退料数量' })
  backNumber: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
