import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_stock
 */
@Entity('kuyou_goods_stock')
export class GoodsStock {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 商品ID */
  @Column({ name: 'goods_id', type: 'int', nullable: false, default: '0', comment: '商品ID' })
  goodsId: number;

  /** 商品编号 */
  @Column({ name: 'goods_code', type: 'varchar', length: 30, nullable: true, comment: '商品编号' })
  goodsCode: string;

  /** 属性组合ID */
  @Column({ name: 'attribute_id', type: 'int', nullable: true, comment: '属性组合ID' })
  attributeId: number;

  /** 仓库ID */
  @Column({ name: 'stores_id', type: 'int', nullable: false, default: '0', comment: '仓库ID' })
  storesId: number;

  /** 库存 */
  @Column({ name: 'stock', type: 'double', nullable: false, default: '0.0000', comment: '库存' })
  stock: number;

  /** 状态:0=关仓,1=正常 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: false, default: '1', comment: '状态:0=关仓,1=正常' })
  status: string;

  /** 期初数量 */
  @Column({ name: 'period', type: 'double', nullable: true, default: '0.0000', comment: '期初数量' })
  period: number;

  /** 单位成本 */
  @Column({ name: 'unit_cost', type: 'double', nullable: true, default: '0.0000', comment: '单位成本' })
  unitCost: number;

  /** 期初总价 */
  @Column({ name: 'price', type: 'double', nullable: true, default: '0.0000', comment: '期初总价' })
  price: number;

  /** 库存预警:0=否,1=是 */
  @Column({ name: 'stock_warning', type: 'varchar', length: 255, nullable: true, default: '0', comment: '库存预警:0=否,1=是' })
  stockWarning: string;

  /** 最低库存 */
  @Column({ name: 'min_stock', type: 'double', nullable: true, default: '0.0000', comment: '最低库存' })
  minStock: number;

  /** 最高库存 */
  @Column({ name: 'max_stock', type: 'double', nullable: true, default: '0.0000', comment: '最高库存' })
  maxStock: number;

  /** 产地 */
  @Column({ name: 'address', type: 'varchar', length: 255, nullable: true, comment: '产地' })
  address: string;

  /** 注册证号 */
  @Column({ name: 'registration', type: 'varchar', length: 100, nullable: true, comment: '注册证号' })
  registration: string;

  /** 生产许可证 */
  @Column({ name: 'production', type: 'varchar', length: 100, nullable: true, comment: '生产许可证' })
  production: string;

  /** 总成本 */
  @Column({ name: 'cost_money', type: 'double', nullable: true, default: '0.0000', comment: '总成本' })
  costMoney: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;

  /** 删除时间 */
  @Column({ name: 'deletetime', type: 'bigint', nullable: true, comment: '删除时间' })
  deletetime: number;
}
