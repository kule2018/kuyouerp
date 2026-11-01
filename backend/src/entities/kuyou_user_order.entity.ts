import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_user_order
 */
@Entity('kuyou_user_order')
export class UserOrder {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 用户ID */
  @Column({ name: 'user_id', type: 'int', nullable: true, comment: '用户ID' })
  userId: number;

  /** 姓名 */
  @Column({ name: 'name', type: 'varchar', length: 255, nullable: true, comment: '姓名' })
  name: string;

  /** 联系方式 */
  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true, comment: '联系方式' })
  phone: string;

  /** 详细地址 */
  @Column({ name: 'address', type: 'varchar', length: 255, nullable: true, comment: '详细地址' })
  address: string;

  /** 订单号 */
  @Column({ name: 'order_num', type: 'varchar', length: 50, nullable: true, default: '', comment: '订单号' })
  orderNum: string;

  /** 订单价格 */
  @Column({ name: 'order_price', type: 'float', nullable: false, default: '0.00', comment: '订单价格' })
  orderPrice: number;

  /** 状态:0=待审核,1=已审核,2=待发货,3=待收货,4=已收货,5=退款中,6=退款完成,7=交易取消,8=交易完成 */
  @Column({ name: 'status', type: 'tinyint', nullable: true, default: '0', comment: '状态:0=待审核,1=已审核,2=待发货,3=待收货,4=已收货,5=退款中,6=退款完成,7=交易取消,8=交易完成' })
  status: number;

  /** 备注 */
  @Column({ name: 'remark', type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark: string;

  /** 支付状态:0=支付中,1=支付成功,2=支付失败 */
  @Column({ name: 'pay_status', type: 'tinyint', nullable: true, default: '0', comment: '支付状态:0=支付中,1=支付成功,2=支付失败' })
  payStatus: number;

  /** 付款时间 */
  @Column({ name: 'pay_time', type: 'bigint', nullable: true, comment: '付款时间' })
  payTime: number;

  /** 配送类型:1=专业配送,2=到店自取 */
  @Column({ name: 'diver_type', type: 'varchar', length: 255, nullable: true, default: '1', comment: '配送类型:1=专业配送,2=到店自取' })
  diverType: string;

  /** 门店ID */
  @Column({ name: 'store_id', type: 'int', nullable: true, comment: '门店ID' })
  storeId: number;

  /** 司机ID */
  @Column({ name: 'diver_id', type: 'int', nullable: true, comment: '司机ID' })
  diverId: number;

  /** 司机姓名 */
  @Column({ name: 'diver_name', type: 'varchar', length: 255, nullable: true, comment: '司机姓名' })
  diverName: string;

  /** 司机电话 */
  @Column({ name: 'diver_phone', type: 'varchar', length: 100, nullable: true, comment: '司机电话' })
  diverPhone: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: true, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: true, comment: '更新时间' })
  updatetime: number;

  /** 删除时间 */
  @Column({ name: 'deletetime', type: 'bigint', nullable: true, comment: '删除时间' })
  deletetime: number;

  /** 快递公司编号 */
  @Column({ name: 'express_code', type: 'varchar', length: 20, nullable: true, comment: '快递公司编号' })
  expressCode: string;

  /** 快递公司名称 */
  @Column({ name: 'express_name', type: 'varchar', length: 255, nullable: true, comment: '快递公司名称' })
  expressName: string;

  /** 快递单号 */
  @Column({ name: 'express_num', type: 'varchar', length: 100, nullable: true, comment: '快递单号' })
  expressNum: string;

  /** 支付信息 */
  @Column({ name: 'pay_info', type: 'text', nullable: true, comment: '支付信息' })
  payInfo: string;

  /** 同步状态码 */
  @Column({ name: 'send_code', type: 'varchar', length: 255, nullable: true, comment: '同步状态码' })
  sendCode: string;

  /** 同步信息 */
  @Column({ name: 'send_msg', type: 'varchar', length: 255, nullable: true, comment: '同步信息' })
  sendMsg: string;
}
