import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_workshop
 */
@Entity('kuyou_workshop')
export class Workshop {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 车间编号 */
  @Column({ name: 'code', type: 'varchar', length: 30, nullable: false, default: '', comment: '车间编号' })
  code: string;

  /** 仓库名称 */
  @Column({ name: 'name', type: 'varchar', length: 255, nullable: false, default: '', comment: '仓库名称' })
  name: string;

  /** 状态:0=关闭,1=正常 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: true, default: '1', comment: '状态:0=关闭,1=正常' })
  status: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
