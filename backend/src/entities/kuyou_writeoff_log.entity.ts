import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_writeoff_log
 */
@Entity('kuyou_writeoff_log')
export class WriteoffLog {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 源单ID */
  @Column({ name: 'source_id', type: 'int', nullable: true, comment: '源单ID' })
  sourceId: number;

  /** 未核销金额 */
  @Column({ name: 'write_off', type: 'double', nullable: true, comment: '未核销金额' })
  writeOff: number;

  /** 已核销金额 */
  @Column({ name: 'money', type: 'double', nullable: true, comment: '已核销金额' })
  money: number;
}
