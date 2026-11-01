import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_sets
 */
@Entity('kuyou_sets')
export class Sets {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 类型:1=基础参数,2=功能参数 */
  @Column({ name: 'type', type: 'tinyint', nullable: true, default: '1', comment: '类型:1=基础参数,2=功能参数' })
  type: number;

  /** 变量名称 */
  @Column({ name: 'name', type: 'varchar', length: 100, nullable: true, comment: '变量名称' })
  name: string;

  /** 名称 */
  @Column({ name: 'nickname', type: 'varchar', length: 100, nullable: true, comment: '名称' })
  nickname: string;

  /** 设置值 */
  @Column({ name: 'value', type: 'varchar', length: 255, nullable: true, comment: '设置值' })
  value: string;

  /** 修改:0=允许,1=不允许 */
  @Column({ name: 'is_edit', type: 'varchar', length: 255, nullable: true, default: '0', comment: '修改:0=允许,1=不允许' })
  isEdit: string;

  /** 提示 */
  @Column({ name: 'notice', type: 'varchar', length: 255, nullable: true, comment: '提示' })
  notice: string;

  /** 说明 */
  @Column({ name: 'explain', type: 'varchar', length: 255, nullable: true, comment: '说明' })
  explain: string;

  /** 是否选中 */
  @Column({ name: 'is_checked', type: 'tinyint', nullable: true, default: '0', comment: '是否选中' })
  isChecked: number;

  /** 场景 */
  @Column({ name: 'set', type: 'text', nullable: true, comment: '场景' })
  set: string;
}
