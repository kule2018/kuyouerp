import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_customer_goodscoding
 */
@Entity('kuyou_customer_goodscoding')
export class CustomerGoodscoding {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 客户 */
  @Column({ name: 'customers_id', type: 'int', nullable: false, default: '0', comment: '客户' })
  customersId: number;

  /** 关联商品 */
  @Column({ name: 'goods_code', type: 'varchar', length: 30, nullable: false, default: '', comment: '关联商品' })
  goodsCode: string;

  /** 单位 */
  @Column({ name: 'unit_id', type: 'int', nullable: true, comment: '单位' })
  unitId: number;

  /** 客户物料编码 */
  @Column({ name: 'customer_code', type: 'varchar', length: 50, nullable: false, default: '', comment: '客户物料编码' })
  customerCode: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
