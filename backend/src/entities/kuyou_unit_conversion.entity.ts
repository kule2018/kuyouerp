import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_unit_conversion
 */
@Entity('kuyou_unit_conversion')
export class UnitConversion {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  @Column({ name: 'unit_name', type: 'varchar', length: 255, nullable: true })
  unitName: string;

  /** 主计量单位 */
  @Column({ name: 'main_unit', type: 'int', nullable: false, default: '0', comment: '主计量单位' })
  mainUnit: number;

  /** 副计量单位 */
  @Column({ name: 'vice_unit', type: 'int', nullable: false, default: '0', comment: '副计量单位' })
  viceUnit: number;

  /** 换算进率 */
  @Column({ name: 'advance_rate', type: 'float', nullable: false, default: '0.00', comment: '换算进率' })
  advanceRate: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
