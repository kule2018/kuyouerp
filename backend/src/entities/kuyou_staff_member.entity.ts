import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_staff_member
 */
@Entity('kuyou_staff_member')
export class StaffMember {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 职员编号 */
  @Column({ name: 'men_code', type: 'varchar', length: 100, nullable: true, comment: '职员编号' })
  menCode: string;

  /** 职员名称 */
  @Column({ name: 'name', type: 'varchar', length: 100, nullable: true, comment: '职员名称' })
  name: string;

  /** 电话 */
  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true, comment: '电话' })
  phone: string;

  /** 状态:0=禁用,1=正常 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: true, default: '1', comment: '状态:0=禁用,1=正常' })
  status: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
