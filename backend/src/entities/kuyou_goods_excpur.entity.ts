import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 对应原 kuyou 表：kuyou_goods_excpur
 */
@Entity('kuyou_goods_excpur')
export class GoodsExcpur {

  /** 主键（自增） */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'exchange_id', type: 'int', nullable: true, default: '0' })
  exchangeId: number;

  @Column({ name: 'purchase_id', type: 'int', nullable: true })
  purchaseId: number;

  /** 单据类型 */
  @Column({ name: 'type', type: 'varchar', length: 255, nullable: true, default: '0', comment: '单据类型' })
  type: string;
}
