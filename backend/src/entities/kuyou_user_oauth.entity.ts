import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_user_oauth
 */
@Entity('kuyou_user_oauth')
export class UserOauth {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 用户 */
  @Column({ name: 'user_id', type: 'int', nullable: true, default: '0', comment: '用户' })
  userId: number;

  /** 厂商 */
  @Column({ name: 'provider', type: 'varchar', length: 50, nullable: false, comment: '厂商' })
  provider: string;

  /** 平台 */
  @Column({ name: 'platform', type: 'varchar', length: 50, nullable: false, comment: '平台' })
  platform: string;

  /** 厂商ID */
  @Column({ name: 'unionid', type: 'varchar', length: 50, nullable: true, comment: '厂商ID' })
  unionid: string;

  /** 平台ID */
  @Column({ name: 'openid', type: 'varchar', length: 50, nullable: false, comment: '平台ID' })
  openid: string;

  /** 昵称 */
  @Column({ name: 'nickname', type: 'varchar', length: 255, nullable: true, default: '', comment: '昵称' })
  nickname: string;

  /** 性别 */
  @Column({ name: 'sex', type: 'tinyint', nullable: true, default: '0', comment: '性别' })
  sex: number;

  /** 国家 */
  @Column({ name: 'country', type: 'varchar', length: 50, nullable: true, comment: '国家' })
  country: string;

  /** 省 */
  @Column({ name: 'province', type: 'varchar', length: 50, nullable: true, comment: '省' })
  province: string;

  /** 市 */
  @Column({ name: 'city', type: 'varchar', length: 50, nullable: true, comment: '市' })
  city: string;

  /** 头像 */
  @Column({ name: 'headimgurl', type: 'varchar', length: 500, nullable: true, default: '', comment: '头像' })
  headimgurl: string;

  /** 登录时间 */
  @Column({ name: 'logintime', type: 'bigint', nullable: true, comment: '登录时间' })
  logintime: number;

  /** 累计登陆 */
  @Column({ name: 'logincount', type: 'int', nullable: true, default: '0', comment: '累计登陆' })
  logincount: number;

  /** 过期周期(s) */
  @Column({ name: 'expire_in', type: 'int', nullable: true, comment: '过期周期(s)' })
  expireIn: number;

  /** 过期时间 */
  @Column({ name: 'expiretime', type: 'bigint', nullable: true, comment: '过期时间' })
  expiretime: number;

  /** session_key */
  @Column({ name: 'session_key', type: 'varchar', length: 45, nullable: true, default: '', comment: 'session_key' })
  sessionKey: string;

  /** refresh_token */
  @Column({ name: 'refresh_token', type: 'varchar', length: 110, nullable: true, comment: 'refresh_token' })
  refreshToken: string;

  /** access_token */
  @Column({ name: 'access_token', type: 'varchar', length: 110, nullable: true, comment: 'access_token' })
  accessToken: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
