import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 表 kuyou_area —— 由 install.sql 自动生成（一比一还原字段）
 * 对应原 kuyou 表：kuyou_area
 */
@Entity('kuyou_area')
export class Area {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 父id */
  @Column({ name: 'pid', type: 'int', nullable: true, comment: '父id' })
  pid: number;

  /** 简称 */
  @Column({ name: 'shortname', type: 'varchar', length: 100, nullable: true, comment: '简称' })
  shortname: string;

  /** 名称 */
  @Column({ name: 'name', type: 'varchar', length: 100, nullable: true, comment: '名称' })
  name: string;

  /** 层级 0 1 2 省市区县 */
  @Column({ name: 'level', type: 'tinyint', nullable: true, comment: '层级 0 1 2 省市区县' })
  level: number;

  /** 地区编号 */
  @Column({ name: 'adcode', type: 'varchar', length: 100, nullable: true, comment: '地区编号' })
  adcode: string;

  /** 经度 */
  @Column({ name: 'lng', type: 'varchar', length: 100, nullable: true, comment: '经度' })
  lng: string;

  /** 纬度 */
  @Column({ name: 'lat', type: 'varchar', length: 100, nullable: true, comment: '纬度' })
  lat: string;

  /** 门店ID */
  @Column({ name: 'salesroom_id', type: 'text', nullable: true, comment: '门店ID' })
  salesroomId: string;
}
