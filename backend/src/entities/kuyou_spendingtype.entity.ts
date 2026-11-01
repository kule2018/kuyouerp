import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_spendingtype
 */
@Entity('kuyou_spendingtype')
export class Spendingtype {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 类型名称 */
  @Column({ name: 'spending_type_name', type: 'varchar', length: 120, nullable: false, default: '', comment: '类型名称' })
  spendingTypeName: string;

  /** 图片 */
  @Column({ name: 'spending_type_image', type: 'varchar', length: 255, nullable: true, comment: '图片' })
  spendingTypeImage: string;

  /** 状态:0=禁用,1=启用 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: true, default: '1', comment: '状态:0=禁用,1=启用' })
  status: string;
}
