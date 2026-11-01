import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_batch
 */
@Entity('kuyou_goods_batch')
export class GoodsBatch {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 商品ID */
  @Column({ name: 'goods_id', type: 'int', nullable: false, default: '0', comment: '商品ID' })
  goodsId: number;

  /** 商品编号 */
  @Column({ name: 'goods_code', type: 'varchar', length: 30, nullable: true, comment: '商品编号' })
  goodsCode: string;

  /** 属性组合ID */
  @Column({ name: 'attribute_id', type: 'int', nullable: true, default: '0', comment: '属性组合ID' })
  attributeId: number;

  /** 仓库ID */
  @Column({ name: 'stores_id', type: 'int', nullable: false, default: '0', comment: '仓库ID' })
  storesId: number;

  /** 批次 */
  @Column({ name: 'batch_name', type: 'varchar', length: 255, nullable: true, comment: '批次' })
  batchName: string;

  /** 生产日期 */
  @Column({ name: 'manufacture', type: 'int', nullable: true, comment: '生产日期' })
  manufacture: number;

  /** 保质期 */
  @Column({ name: 'guarantee', type: 'int', nullable: true, comment: '保质期' })
  guarantee: number;

  /** 有效期至 */
  @Column({ name: 'validity', type: 'int', nullable: true, comment: '有效期至' })
  validity: number;

  /** 产地 */
  @Column({ name: 'address', type: 'varchar', length: 255, nullable: true, comment: '产地' })
  address: string;

  /** 注册证号 */
  @Column({ name: 'registration', type: 'varchar', length: 255, nullable: true, comment: '注册证号' })
  registration: string;

  /** 生产许可证 */
  @Column({ name: 'production', type: 'varchar', length: 255, nullable: true, comment: '生产许可证' })
  production: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
