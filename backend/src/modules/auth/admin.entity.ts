import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 后台管理员表（对应 FastAdmin 核心表 admin）
 * 注意：kuyou 的 install.sql 不含此表，这里单独还原，保证后台登录可一比一迁移。
 * 密码方案与 FastAdmin 一致：password = md5(md5(明文) + salt)
 */
@Entity('admin')
export class Admin {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'username', type: 'varchar', length: 20, nullable: false, default: '', comment: '用户名' })
  username: string;

  @Column({ name: 'nickname', type: 'varchar', length: 50, nullable: false, default: '', comment: '昵称' })
  nickname: string;

  @Column({ name: 'password', type: 'varchar', length: 32, nullable: false, default: '', comment: '密码(md5)' })
  password: string;

  @Column({ name: 'salt', type: 'varchar', length: 30, nullable: false, default: '', comment: '密码盐' })
  salt: string;

  @Column({ name: 'avatar', type: 'varchar', length: 255, nullable: true, comment: '头像' })
  avatar: string;

  @Column({ name: 'email', type: 'varchar', length: 100, nullable: true, comment: '邮箱' })
  email: string;

  @Column({ name: 'loginfailure', type: 'tinyint', nullable: false, default: 0, comment: '失败次数' })
  loginfailure: number;

  @Column({ name: 'logintime', type: 'bigint', nullable: true, comment: '登录时间' })
  logintime: number;

  @Column({ name: 'loginip', type: 'varchar', length: 50, nullable: true, comment: '登录IP' })
  loginip: string;

  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;

  @Column({ name: 'status', type: 'varchar', length: 30, nullable: false, default: 'normal', comment: '状态' })
  status: string;

  @Column({ name: 'role_id', type: 'int', nullable: false, default: 0, comment: '角色ID（0=超级管理员）' })
  roleId: number;

  @Column({ name: 'token', type: 'varchar', length: 59, nullable: true, comment: '登录令牌' })
  token: string;
}
