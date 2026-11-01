import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_transfers
 */
@Entity('kuyou_transfers')
export class Transfers {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 单据编号 */
  @Column({ name: 'documents_code', type: 'varchar', length: 50, nullable: false, comment: '单据编号' })
  documentsCode: string;

  /** 单据日期 */
  @Column({ name: 'documents_date', type: 'varchar', length: 50, nullable: false, comment: '单据日期' })
  documentsDate: string;

  /** 商品编号 */
  @Column({ name: 'goods_code', type: 'varchar', length: 100, nullable: false, comment: '商品编号' })
  goodsCode: string;

  /** 商品类别 */
  @Column({ name: 'goods_type_id', type: 'int', nullable: false, comment: '商品类别' })
  goodsTypeId: number;

  /** 商品备注 */
  @Column({ name: 'goodsnote', type: 'text', nullable: false, comment: '商品备注' })
  goodsnote: string;

  /** 创建时间 */
  @Column({ name: 'createtime', type: 'bigint', nullable: false, comment: '创建时间' })
  createtime: number;

  /** 更新时间 */
  @Column({ name: 'updatetime', type: 'bigint', nullable: false, comment: '更新时间' })
  updatetime: number;

  /** 删除时间 */
  @Column({ name: 'deletetime', type: 'bigint', nullable: true, comment: '删除时间' })
  deletetime: number;

  /** 数量 */
  @Column({ name: 'num', type: 'int', nullable: false, comment: '数量' })
  num: number;

  /** 单位 */
  @Column({ name: 'unit_id', type: 'int', nullable: false, comment: '单位' })
  unitId: number;

  /** 调出仓库 */
  @Column({ name: 'out_store_id', type: 'int', nullable: false, comment: '调出仓库' })
  outStoreId: number;

  /** 调入仓库 */
  @Column({ name: 'to_store_id', type: 'int', nullable: false, comment: '调入仓库' })
  toStoreId: number;

  /** 制单人 */
  @Column({ name: 'maker_id', type: 'int', nullable: false, comment: '制单人' })
  makerId: number;

  /** 分录备注 */
  @Column({ name: 'fl_note', type: 'text', nullable: false, comment: '分录备注' })
  flNote: string;

  /** 审核人 */
  @Column({ name: 'audit', type: 'varchar', length: 100, nullable: false, comment: '审核人' })
  audit: string;

  /** 备注 */
  @Column({ name: 'main_note', type: 'text', nullable: false, comment: '备注' })
  mainNote: string;
}
