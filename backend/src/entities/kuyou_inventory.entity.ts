import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_inventory
 */
@Entity('kuyou_inventory')
export class Inventory {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 盘点编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 50, nullable: true, comment: '盘点编号' })
  purchaseCode: string;

  /** 盘点时间 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '盘点时间' })
  purchaseTime: number;

  /** 盘点仓库:1=全部仓库,2=单仓 */
  @Column({ name: 'store_type', type: 'varchar', length: 255, nullable: true, default: '1', comment: '盘点仓库:1=全部仓库,2=单仓' })
  storeType: string;

  /** 盘点结果 */
  @Column({ name: 'result', type: 'varchar', length: 255, nullable: true, comment: '盘点结果' })
  result: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
