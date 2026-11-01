import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_customertype
 */
@Entity('kuyou_customertype')
export class Customertype {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 分类名称 */
  @Column({ name: 'type_name', type: 'varchar', length: 100, nullable: false, comment: '分类名称' })
  typeName: string;

  /** 上级分类id */
  @Column({ name: 'pid', type: 'int', nullable: false, default: '0', comment: '上级分类id' })
  pid: number;

  @Column({ name: 'path', type: 'varchar', length: 255, nullable: true })
  path: string;

  /** 分类图 */
  @Column({ name: 'type_image', type: 'varchar', length: 255, nullable: true, comment: '分类图' })
  typeImage: string;

  /** 状态:0=禁用,1=正常 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: false, default: '0', comment: '状态:0=禁用,1=正常' })
  status: string;
}
