import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_stock_warning
 */
@Entity('kuyou_goods_stock_warning')
export class GoodsStockWarning {

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

  /** 仓库ID */
  @Column({ name: 'stores_id', type: 'int', nullable: false, default: '0', comment: '仓库ID' })
  storesId: number;

  /** 状态:0=关仓,1=正常 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: false, default: '1', comment: '状态:0=关仓,1=正常' })
  status: string;

  /** 库存预警:0=否,1=是 */
  @Column({ name: 'stock_warning', type: 'varchar', length: 255, nullable: true, default: '0', comment: '库存预警:0=否,1=是' })
  stockWarning: string;

  /** 最低库存 */
  @Column({ name: 'min_stock', type: 'double', nullable: true, comment: '最低库存' })
  minStock: number;

  /** 最高库存 */
  @Column({ name: 'max_stock', type: 'double', nullable: true, comment: '最高库存' })
  maxStock: number;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;
}
