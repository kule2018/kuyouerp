import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 表 kuyou_checkout_info —— 由 install.sql 自动生成（一比一还原字段）
 * 对应原 kuyou 表：kuyou_checkout_info
 */
@Entity('kuyou_checkout_info')
export class CheckoutInfo {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 结账ID */
  @Column({ name: 'checkout_id', type: 'int', nullable: true, comment: '结账ID' })
  checkoutId: number;

  /** 商品名称 */
  @Column({ name: 'goods_id', type: 'int', nullable: true, comment: '商品名称' })
  goodsId: number;

  /** 商品编号 */
  @Column({ name: 'goods_code', type: 'varchar', length: 50, nullable: true, comment: '商品编号' })
  goodsCode: string;

  /** 数量 */
  @Column({ name: 'basic_nmber', type: 'decimal', precision: 15, scale: 4, nullable: true, default: '0.0000', comment: '数量' })
  basicNmber: number;

  /** 成本 */
  @Column({ name: 'all_money', type: 'decimal', precision: 15, scale: 4, nullable: true, default: '0.0000', comment: '成本' })
  allMoney: number;

  /** 结账截止购货ID */
  @Column({ name: 'purchase_id', type: 'int', nullable: true, comment: '结账截止购货ID' })
  purchaseId: number;

  /** 单据时间 */
  @Column({ name: 'purchase_time', type: 'bigint', nullable: true, comment: '单据时间' })
  purchaseTime: number;

  /** 移动平均数量 */
  @Column({ name: 'av_basic_nmber', type: 'decimal', precision: 15, scale: 4, nullable: true, default: '0.0000', comment: '移动平均数量' })
  avBasicNmber: number;

  /** 移动平均成本 */
  @Column({ name: 'av_all_money', type: 'decimal', precision: 15, scale: 4, nullable: true, default: '0.0000', comment: '移动平均成本' })
  avAllMoney: number;
}
