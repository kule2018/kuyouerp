import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

/**
 * 库存盘点过账（stocktake）
 * 新建盘点单（带入系统库存），审核过账时按盘盈/盘亏写入商品收发明细(kuyou_goods_log)
 * 并校正 kuyou_goods.inventory。business_type: 8=盘盈, 10=盘亏。
 */
@Injectable()
export class StocktakeService {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  private code() { return 'PD' + Date.now() + Math.floor(Math.random() * 1000); }

  /** 盘点单列表 */
  async list(limit = 100) {
    return this.conn.query(
      `SELECT s.*, COUNT(i.id) AS item_count FROM kuyou_stocktake s
       LEFT JOIN kuyou_stocktake_info i ON i.stocktake_id = s.id
       GROUP BY s.id ORDER BY s.createtime DESC LIMIT ?`, [limit]);
  }

  /** 盘点单明细 */
  async detail(id: number) {
    return this.conn.query(`SELECT * FROM kuyou_stocktake_info WHERE stocktake_id=?`, [id]);
  }

  /** 新建盘点单（草稿） */
  async add(dto: any) {
    const admin_id = dto.admin_id || 0;
    const stores_id = Number(dto.stores_id) || 0;
    const items: any[] = Array.isArray(dto.items) ? dto.items : [];
    if (!items.length) return { code: 0, msg: '请至少录入一个商品' };
    const now = Math.floor(Date.now() / 1000);
    const purchase_code = this.code();
    try {
      const r: any = await this.conn.query(
        `INSERT INTO kuyou_stocktake (admin_id,purchase_code,purchase_time,stores_id,examine_status,preparation_id,remark,createtime,updatetime)
         VALUES (?,?,?,?,0,?,?,?,?)`,
        [admin_id, purchase_code, now, stores_id, admin_id, dto.remark || '', now, now],
      );
      const sid = r.insertId;
      for (const it of items) {
        const goods_id = Number(it.goods_id);
        const actual = Number(it.actual_stock) || 0;
        const g: any = await this.conn.query(
          `SELECT goods_code, goods_name, inventory, unit_cost FROM kuyou_goods WHERE id=?`, [goods_id]);
        const sys = Number(g[0]?.inventory) || 0;
        const unit_cost = Number(g[0]?.unit_cost) || 0;
        const profit = Math.round((actual - sys) * 10000) / 10000;
        await this.conn.query(
          `INSERT INTO kuyou_stocktake_info (admin_id,stocktake_id,purchase_code,goods_id,goods_code,goods_name,stores_id,system_stock,actual_stock,profit_loss,unit_cost,createtime,updatetime)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [admin_id, sid, purchase_code, goods_id, g[0]?.goods_code || '', g[0]?.goods_name || '', stores_id, sys, actual, profit, unit_cost, now, now],
        );
      }
      return { code: 1, msg: '盘点单已保存', id: sid, purchase_code };
    } catch (e: any) { return { code: 0, msg: '失败', error: e?.message || String(e) }; }
  }

  /** 审核过账：盘盈盘亏写入收发明细并校正库存 */
  async post(id: number, admin_id = 0) {
    if (!id) return { code: 0, msg: '缺少盘点单ID' };
    const now = Math.floor(Date.now() / 1000);
    const head: any = await this.conn.query(`SELECT * FROM kuyou_stocktake WHERE id=?`, [id]);
    if (!head[0]) return { code: 0, msg: '盘点单不存在' };
    if (head[0].examine_status === '1') return { code: 0, msg: '已审核，不能重复过账' };
    try {
      await this.conn.transaction(async (m) => {
        const infos: any = await m.query(`SELECT * FROM kuyou_stocktake_info WHERE stocktake_id=?`, [id]);
        for (const d of infos) {
          if (Number(d.profit_loss) === 0) continue;
          const isProfit = Number(d.profit_loss) > 0;
          const bt = isProfit ? 8 : 10; // 8=盘盈 10=盘亏
          const qty = Math.abs(Number(d.profit_loss));
          const cost = Math.round(qty * Number(d.unit_cost) * 10000) / 10000;
          await m.query(
            `INSERT INTO kuyou_goods_log
             (admin_id,purchase_code,purchase_id,purchase_time,business_type,goods_id,goods_code,goods_unit,stores_id,
              enter_number,enter_unit,enter_cost,out_number,out_unit,out_cost,balance_basics,balance_unit,balance_cost)
             VALUES (?,?,?,?,?,?,?,0,?,?,?,?,?,?,?,?,?,?)`,
            [admin_id, head[0].purchase_code, id, now, bt, d.goods_id, d.goods_code, d.stores_id,
             isProfit ? qty : 0, d.unit_cost, isProfit ? cost : 0,
             isProfit ? 0 : qty, d.unit_cost, isProfit ? 0 : cost,
             d.actual_stock, d.unit_cost, Math.round(d.actual_stock * Number(d.unit_cost) * 10000) / 10000],
          );
          await m.query(`UPDATE kuyou_goods SET inventory=? WHERE id=?`, [d.actual_stock, d.goods_id]);
        }
        await m.query(`UPDATE kuyou_stocktake SET examine_status='1', examine_id=?, examine_time=? WHERE id=?`,
          [admin_id, now, id]);
        await m.query(
          `INSERT INTO kuyou_operate_log (admin_id,module,action,content,createtime) VALUES (?,?,?,?,?)`,
          [admin_id, 'stocktake', 'post', `盘点单 ${head[0].purchase_code} 过账`, now],
        );
      });
      return { code: 1, msg: '盘点过账成功' };
    } catch (e: any) { return { code: 0, msg: '失败', error: e?.message || String(e) }; }
  }
}
