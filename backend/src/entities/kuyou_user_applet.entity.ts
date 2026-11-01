import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_user_applet
 */
@Entity('kuyou_user_applet')
export class UserApplet {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 用户ID */
  @Column({ name: 'user_id', type: 'int', nullable: true, comment: '用户ID' })
  userId: number;

  /** 组名 */
  @Column({ name: 'name', type: 'varchar', length: 50, nullable: true, default: '', comment: '组名' })
  name: string;

  /** 权限节点 */
  @Column({ name: 'rules', type: 'text', nullable: true, comment: '权限节点' })
  rules: string;

  /** 小程序规则 */
  @Column({ name: 'applet', type: 'text', nullable: true, comment: '小程序规则' })
  applet: string;

  /** 添加时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '添加时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;

  /** 状态 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: true, comment: '状态' })
  status: string;

  /** 图片 */
  @Column({ name: 'image', type: 'varchar', length: 255, nullable: true, comment: '图片' })
  image: string;
}
