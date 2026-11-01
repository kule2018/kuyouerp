import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_bom_procedure
 */
@Entity('kuyou_bom_procedure')
export class BomProcedure {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 清单ID */
  @Column({ name: 'bom_id', type: 'int', nullable: true, comment: '清单ID' })
  bomId: number;

  /** 工序编号 */
  @Column({ name: 'purchase_code', type: 'varchar', length: 255, nullable: true, comment: '工序编号' })
  purchaseCode: string;

  /** 工序名称 */
  @Column({ name: 'name', type: 'varchar', length: 255, nullable: true, comment: '工序名称' })
  name: string;

  /** 车间ID */
  @Column({ name: 'workshop_id', type: 'int', nullable: true, comment: '车间ID' })
  workshopId: number;

  /** 单位工资 */
  @Column({ name: 'wages', type: 'double', nullable: true, default: '0.0000', comment: '单位工资' })
  wages: number;

  /** 标准工时 */
  @Column({ name: 'hours', type: 'float', nullable: true, default: '0.00', comment: '标准工时' })
  hours: number;

  /** 备注 */
  @Column({ name: 'remark', type: 'text', nullable: true, comment: '备注' })
  remark: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
