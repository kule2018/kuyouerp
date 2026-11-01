import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_aux_combination
 */
@Entity('kuyou_aux_combination')
export class AuxCombination {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 属性组合ID(从小到大) */
  @Column({ name: 'attr_ids', type: 'varchar', length: 255, nullable: false, default: '', comment: '属性组合ID(从小到大)' })
  attrIds: string;

  /** 属性编号 */
  @Column({ name: 'attr_code', type: 'varchar', length: 30, nullable: false, default: '', comment: '属性编号' })
  attrCode: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
