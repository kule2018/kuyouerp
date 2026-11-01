import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_settlementtype
 */
@Entity('kuyou_settlementtype')
export class Settlementtype {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 结算方式名称 */
  @Column({ name: 'name', type: 'varchar', length: 100, nullable: false, default: '', comment: '结算方式名称' })
  name: string;

  /** 图片 */
  @Column({ name: 'image', type: 'varchar', length: 255, nullable: true, comment: '图片' })
  image: string;

  /** 结算方式状态:0=禁用,1=启用 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: false, default: '1', comment: '结算方式状态:0=禁用,1=启用' })
  status: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 编辑时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '编辑时间' })
  updatetime: number;

  /** 删除时间 */
  @Column({ name: 'deletetime', type: 'bigint', nullable: true, comment: '删除时间' })
  deletetime: number;
}
