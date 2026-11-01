import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods
 */
@Entity('kuyou_goods')
export class Goods {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_id', type: 'int', nullable: true })
  adminId: number;

  /** 商品编号 */
  @Column({ name: 'goods_code', type: 'varchar', length: 30, nullable: false, default: '', comment: '商品编号' })
  goodsCode: string;

  /** 商品名称 */
  @Column({ name: 'goods_name', type: 'varchar', length: 255, nullable: false, default: '', comment: '商品名称' })
  goodsName: string;

  /** 商品条码 */
  @Column({ name: 'goods_barcode', type: 'varchar', length: 50, nullable: true, default: '', comment: '商品条码' })
  goodsBarcode: string;

  /** 规格型号 */
  @Column({ name: 'goods_specification_id', type: 'varchar', length: 50, nullable: false, default: '', comment: '规格型号' })
  goodsSpecificationId: string;

  /** 商品类别 */
  @Column({ name: 'goods_type_id', type: 'int', nullable: false, default: '0', comment: '商品类别' })
  goodsTypeId: number;

  /** 首选仓库 */
  @Column({ name: 'manager_warehouse_id', type: 'int', nullable: false, default: '0', comment: '首选仓库' })
  managerWarehouseId: number;

  /** 计量单位 */
  @Column({ name: 'unit_id', type: 'int', nullable: false, default: '0', comment: '计量单位' })
  unitId: number;

  /** 多计量单位:1=是,2=否 */
  @Column({ name: 'more_unit', type: 'varchar', length: 255, nullable: false, default: '2', comment: '多计量单位:1=是,2=否' })
  moreUnit: string;

  /** 多单位ID */
  @Column({ name: 'more_unit_id', type: 'int', nullable: true, comment: '多单位ID' })
  moreUnitId: number;

  /** 零售价 */
  @Column({ name: 'market_sell_price', type: 'double', nullable: false, default: '0.0000', comment: '零售价' })
  marketSellPrice: number;

  /** 批发价 */
  @Column({ name: 'wholesale_price', type: 'double', nullable: false, default: '0.0000', comment: '批发价' })
  wholesalePrice: number;

  /** vip会员价 */
  @Column({ name: 'vip_price', type: 'double', nullable: false, default: '0.0000', comment: 'vip会员价' })
  vipPrice: number;

  /** 折扣率1 */
  @Column({ name: 'discount', type: 'double', nullable: true, default: '0.0000', comment: '折扣率1' })
  discount: number;

  /** 折扣率2 */
  @Column({ name: 'discount2', type: 'double', nullable: true, default: '0.0000', comment: '折扣率2' })
  discount2: number;

  /** 预计采购价 */
  @Column({ name: 'purchase', type: 'double', nullable: true, default: '0.0000', comment: '预计采购价' })
  purchase: number;

  /** 商品主图 */
  @Column({ name: 'goods_image', type: 'varchar', length: 255, nullable: false, default: '', comment: '商品主图' })
  goodsImage: string;

  /** 商品图集 */
  @Column({ name: 'goods_images', type: 'text', nullable: true, comment: '商品图集' })
  goodsImages: string;

  /** 商品详情 */
  @Column({ name: 'content', type: 'text', nullable: true, comment: '商品详情' })
  content: string;

  /** 总库存 */
  @Column({ name: 'inventory', type: 'double', nullable: false, default: '0.0000', comment: '总库存' })
  inventory: number;

  /** 多属性:0=否,1=是 */
  @Column({ name: 'more_attribute', type: 'varchar', length: 255, nullable: true, default: '0', comment: '多属性:0=否,1=是' })
  moreAttribute: string;

  /** 商品属性条码 */
  @Column({ name: 'attribute_id', type: 'varchar', length: 30, nullable: true, default: '', comment: '商品属性条码' })
  attributeId: string;

  /** 备注 */
  @Column({ name: 'note', type: 'varchar', length: 255, nullable: false, comment: '备注' })
  note: string;

  /** 是否常用:0=否,1=是 */
  @Column({ name: 'is_offten', type: 'varchar', length: 255, nullable: false, default: '0', comment: '是否常用:0=否,1=是' })
  isOfften: string;

  /** 库存预警:0=否,1=是 */
  @Column({ name: 'stock_warning', type: 'varchar', length: 255, nullable: true, default: '0', comment: '库存预警:0=否,1=是' })
  stockWarning: string;

  /** 最低库存 */
  @Column({ name: 'min_stock', type: 'int', nullable: true, default: '0', comment: '最低库存' })
  minStock: number;

  /** 最高库存 */
  @Column({ name: 'max_stock', type: 'int', nullable: true, default: '0', comment: '最高库存' })
  maxStock: number;

  /** 分仓预警:0=否,1=是 */
  @Column({ name: 'branch', type: 'varchar', length: 255, nullable: true, default: '0', comment: '分仓预警:0=否,1=是' })
  branch: string;

  /** 首选入库单位 */
  @Column({ name: 'warehousing', type: 'int', nullable: true, comment: '首选入库单位' })
  warehousing: number;

  /** 首选出库单位 */
  @Column({ name: 'warehouse', type: 'int', nullable: true, comment: '首选出库单位' })
  warehouse: number;

  /** 期初数量 */
  @Column({ name: 'period', type: 'double', nullable: true, default: '0.0000', comment: '期初数量' })
  period: number;

  /** 单位成本 */
  @Column({ name: 'unit_cost', type: 'double', nullable: true, default: '0.0000', comment: '单位成本' })
  unitCost: number;

  /** 期初总价 */
  @Column({ name: 'price', type: 'double', nullable: true, default: '0.0000', comment: '期初总价' })
  price: number;

  /** 期初设置 */
  @Column({ name: 'period_status', type: 'varchar', length: 255, nullable: true, default: '0', comment: '期初设置' })
  periodStatus: string;

  /** 状态:0=下架,1=上架 */
  @Column({ name: 'status', type: 'varchar', length: 255, nullable: false, default: '1', comment: '状态:0=下架,1=上架' })
  status: string;

  /** 允许修改:0=否,1=是 */
  @Column({ name: 'is_edit', type: 'varchar', length: 255, nullable: true, default: '1', comment: '允许修改:0=否,1=是' })
  isEdit: string;

  /** 设置商品辅助属性 */
  @Column({ name: 'auxiliary', type: 'tinyint', nullable: true, comment: '设置商品辅助属性' })
  auxiliary: number;

  /** 辅助属性 */
  @Column({ name: 'auxiliary_type', type: 'varchar', length: 255, nullable: true, comment: '辅助属性' })
  auxiliaryType: string;

  /** 辅助属性2 */
  @Column({ name: 'auxiliary_type_c', type: 'varchar', length: 255, nullable: true, comment: '辅助属性2' })
  auxiliaryTypeC: string;

  /** 启用批次保质期管理 */
  @Column({ name: 'batch', type: 'tinyint', nullable: true, comment: '启用批次保质期管理' })
  batch: number;

  /** 保质期天数 */
  @Column({ name: 'shelf_life', type: 'int', nullable: true, comment: '保质期天数' })
  shelfLife: number;

  /** 预警天数 */
  @Column({ name: 'early_warning', type: 'int', nullable: true, comment: '预警天数' })
  earlyWarning: number;

  /** 启用序列号 */
  @Column({ name: 'serial', type: 'tinyint', nullable: true, comment: '启用序列号' })
  serial: number;

  /** 标签 */
  @Column({ name: 'tag', type: 'varchar', length: 255, nullable: true, default: 'sale', comment: '标签' })
  tag: string;

  /** 销量 */
  @Column({ name: 'sale_number', type: 'double', nullable: true, default: '0.0000', comment: '销量' })
  saleNumber: number;

  /** 订货通显示状态:0=否,1=是 */
  @Column({ name: 'order_status', type: 'varchar', length: 255, nullable: true, default: '1', comment: '订货通显示状态:0=否,1=是' })
  orderStatus: string;

  /** 商品类型:1=原材料,2=成品 */
  @Column({ name: 'goods_type', type: 'varchar', length: 255, nullable: true, default: '1', comment: '商品类型:1=原材料,2=成品' })
  goodsType: string;

  /** 是否促销:0=否,1=是 */
  @Column({ name: 'promotion', type: 'varchar', length: 255, nullable: true, default: '0', comment: '是否促销:0=否,1=是' })
  promotion: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;

  @Column({ name: 'deletetime', type: 'bigint', nullable: true })
  deletetime: number;
}
