import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_user_orderinfo
 */
@Entity('kuyou_user_orderinfo')
export class UserOrderinfo {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 用户ID */
  @Column({ name: 'user_id', type: 'int', nullable: true, comment: '用户ID' })
  userId: number;

  /** 订单ID */
  @Column({ name: 'order_id', type: 'int', nullable: true, comment: '订单ID' })
  orderId: number;

  /** 商品ID */
  @Column({ name: 'goods_id', type: 'int', nullable: false, default: '0', comment: '商品ID' })
  goodsId: number;

  /** 商品单位 */
  @Column({ name: 'goods_unit', type: 'int', nullable: true, comment: '商品单位' })
  goodsUnit: number;

  /** 商品属性 */
  @Column({ name: 'goods_attr', type: 'int', nullable: true, comment: '商品属性' })
  goodsAttr: number;

  /** 商品名称 */
  @Column({ name: 'goods_name', type: 'varchar', length: 255, nullable: true, comment: '商品名称' })
  goodsName: string;

  /** 商品图片 */
  @Column({ name: 'goods_image', type: 'varchar', length: 255, nullable: true, comment: '商品图片' })
  goodsImage: string;

  /** 单位名称 */
  @Column({ name: 'unit_name', type: 'varchar', length: 255, nullable: true, comment: '单位名称' })
  unitName: string;

  /** 属性名称 */
  @Column({ name: 'attr_name', type: 'varchar', length: 255, nullable: true, comment: '属性名称' })
  attrName: string;

  /** 数量 */
  @Column({ name: 'number', type: 'float', nullable: false, default: '0.00', comment: '数量' })
  number: number;

  /** 单价 */
  @Column({ name: 'price', type: 'float', nullable: false, default: '0.00', comment: '单价' })
  price: number;

  /** 总价 */
  @Column({ name: 'money', type: 'float', nullable: false, default: '0.00', comment: '总价' })
  money: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
