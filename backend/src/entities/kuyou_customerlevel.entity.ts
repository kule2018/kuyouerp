import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_customerlevel
 */
@Entity('kuyou_customerlevel')
export class Customerlevel {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 等级名称 */
  @Column({ name: 'name', type: 'varchar', length: 100, nullable: false, default: '', comment: '等级名称' })
  name: string;

  /** 状态:0=禁用,1=正常 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: false, default: '0', comment: '状态:0=禁用,1=正常' })
  status: string;
}
