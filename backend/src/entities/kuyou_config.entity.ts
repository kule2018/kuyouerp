import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_config
 */
@Entity('kuyou_config')
export class Config {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 变量名 */
  @Column({ name: 'name', type: 'varchar', length: 30, nullable: true, default: '', comment: '变量名' })
  name: string;

  /** 分组 */
  @Column({ name: 'group', type: 'varchar', length: 30, nullable: true, default: '', comment: '分组' })
  group: string;

  /** 变量标题 */
  @Column({ name: 'title', type: 'varchar', length: 100, nullable: true, default: '', comment: '变量标题' })
  title: string;

  /** 变量描述 */
  @Column({ name: 'tip', type: 'varchar', length: 100, nullable: true, default: '', comment: '变量描述' })
  tip: string;

  /** 类型:string,text,int,bool,array,datetime,date,file */
  @Column({ name: 'type', type: 'varchar', length: 30, nullable: true, default: '', comment: '类型:string,text,int,bool,array,datetime,date,file' })
  type: string;

  /** 变量值 */
  @Column({ name: 'value', type: 'text', nullable: true, comment: '变量值' })
  value: string;

  /** 变量字典数据 */
  @Column({ name: 'content', type: 'text', nullable: true, comment: '变量字典数据' })
  content: string;

  /** 验证规则 */
  @Column({ name: 'rule', type: 'varchar', length: 100, nullable: true, default: '', comment: '验证规则' })
  rule: string;

  /** 扩展属性 */
  @Column({ name: 'extend', type: 'varchar', length: 255, nullable: true, default: '', comment: '扩展属性' })
  extend: string;

  /** 配置 */
  @Column({ name: 'setting', type: 'varchar', length: 255, nullable: true, default: '', comment: '配置' })
  setting: string;
}
