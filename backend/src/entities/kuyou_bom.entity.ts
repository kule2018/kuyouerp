import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_bom
 */
@Entity('kuyou_bom')
export class Bom {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 单据编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: true, comment: '单据编号' })
  purchaseCode: string;

  /** 清单名称 */
  @Column({ name: 'name', type: 'varchar', length: 255, nullable: true, comment: '清单名称' })
  name: string;

  /** 商品名称 */
  @Column({ name: 'goods_name', type: 'varchar', length: 255, nullable: true, comment: '商品名称' })
  goodsName: string;

  /** 商品编号 */
  @Column({ name: 'goods_code', type: 'varchar', length: 100, nullable: true, comment: '商品编号' })
  goodsCode: string;

  /** 数量 */
  @Column({ name: 'number', type: 'double', nullable: true, comment: '数量' })
  number: number;

  /** 金额 */
  @Column({ name: 'all_money', type: 'float', nullable: true, comment: '金额' })
  allMoney: number;

  /** 计件工资 */
  @Column({ name: 'wages', type: 'double', nullable: true, default: '0.0000', comment: '计件工资' })
  wages: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
