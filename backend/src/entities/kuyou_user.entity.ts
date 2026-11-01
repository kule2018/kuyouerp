import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 表 kuyou_user —— 由 install.sql 自动生成（一比一还原字段）
 * 对应原 kuyou 表：kuyou_user
 */
@Entity('kuyou_user')
export class User {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 组别ID */
  @Column({ name: 'group_id', type: 'int', nullable: true, default: '0', comment: '组别ID' })
  groupId: number;

  /** 用户名 */
  @Column({ name: 'username', type: 'varchar', length: 32, nullable: true, default: '', comment: '用户名' })
  username: string;

  /** 昵称 */
  @Column({ name: 'nickname', type: 'varchar', length: 50, nullable: true, default: '', comment: '昵称' })
  nickname: string;

  /** 密码 */
  @Column({ name: 'password', type: 'varchar', length: 32, nullable: true, default: '', comment: '密码' })
  password: string;

  /** 密码盐 */
  @Column({ name: 'salt', type: 'varchar', length: 30, nullable: true, default: '', comment: '密码盐' })
  salt: string;

  /** 电子邮箱 */
  @Column({ name: 'email', type: 'varchar', length: 100, nullable: true, default: '', comment: '电子邮箱' })
  email: string;

  /** 手机号 */
  @Column({ name: 'mobile', type: 'varchar', length: 11, nullable: true, default: '', comment: '手机号' })
  mobile: string;

  /** 头像 */
  @Column({ name: 'avatar', type: 'varchar', length: 255, nullable: true, default: '', comment: '头像' })
  avatar: string;

  /** 等级 */
  @Column({ name: 'level', type: 'tinyint', nullable: false, default: '0', comment: '等级' })
  level: number;

  /** 性别 */
  @Column({ name: 'gender', type: 'tinyint', nullable: false, default: '0', comment: '性别' })
  gender: number;

  /** 生日 */
  @Column({ name: 'birthday', type: 'datetime', nullable: true, comment: '生日' })
  birthday: Date;

  /** 格言 */
  @Column({ name: 'bio', type: 'varchar', length: 100, nullable: true, default: '', comment: '格言' })
  bio: string;

  /** 余额 */
  @Column({ name: 'money', type: 'decimal', precision: 10, scale: 2, nullable: false, default: '0.00', comment: '余额' })
  money: number;

  /** 积分 */
  @Column({ name: 'score', type: 'int', nullable: false, default: '0', comment: '积分' })
  score: number;

  /** 连续登录天数 */
  @Column({ name: 'successions', type: 'int', nullable: false, default: '1', comment: '连续登录天数' })
  successions: number;

  /** 最大连续登录天数 */
  @Column({ name: 'maxsuccessions', type: 'int', nullable: false, default: '1', comment: '最大连续登录天数' })
  maxsuccessions: number;

  /** 上次登录时间 */
  @Column({ name: 'prevtime', type: 'bigint', nullable: true, comment: '上次登录时间' })
  prevtime: number;

  /** 登录时间 */
  @Column({ name: 'logintime', type: 'bigint', nullable: true, comment: '登录时间' })
  logintime: number;

  /** 登录IP */
  @Column({ name: 'loginip', type: 'varchar', length: 50, nullable: true, default: '', comment: '登录IP' })
  loginip: string;

  /** 失败次数 */
  @Column({ name: 'loginfailure', type: 'tinyint', nullable: false, default: '0', comment: '失败次数' })
  loginfailure: number;

  /** 加入IP */
  @Column({ name: 'joinip', type: 'varchar', length: 50, nullable: true, default: '', comment: '加入IP' })
  joinip: string;

  /** 加入时间 */
  @Column({ name: 'jointime', type: 'bigint', nullable: true, comment: '加入时间' })
  jointime: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;

  /** 删除时间 */
  @Column({ name: 'deletetime', type: 'bigint', nullable: true, comment: '删除时间' })
  deletetime: number;

  /** Token */
  @Column({ name: 'token', type: 'varchar', length: 50, nullable: true, default: '', comment: 'Token' })
  token: string;

  /** 状态 */
  @Column({ name: 'status', type: 'varchar', length: 30, nullable: true, default: '', comment: '状态' })
  status: string;

  /** 验证 */
  @Column({ name: 'verification', type: 'varchar', length: 255, nullable: true, default: '', comment: '验证' })
  verification: string;

  /** 是否绑定 */
  @Column({ name: 'binding', type: 'tinyint', nullable: false, default: '2', comment: '是否绑定' })
  binding: number;

  /** 客户ID */
  @Column({ name: 'customers_id', type: 'int', nullable: true, comment: '客户ID' })
  customersId: number;
}
