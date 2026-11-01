import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

/**
 * 收付款核销（finance）
 * 真实业务：收款单(kuyou_collection) / 付款单(kuyou_payment) 审核过账时，
 * 冲减客户应收(kuyou_customers.need_receive_account) / 供应商应付(kuyou_suppliers.need_give_account)，
 * 并写入应收/应付明细、账户流水(kuyou_accounts_log)、更新结算账户余额。
 */
@Injectable()
export class FinanceService {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  private code(prefix: string) {
    return prefix + Date.now() + Math.floor(Math.random() * 1000);
  }

  /** 新增并过账收款单 */
  async addCollection(dto: any) {
    const admin_id = dto.admin_id || 0;
    const customers_id = Number(dto.customers_id);
    const money = Number(dto.money) || 0;
    const accounts_id = Number(dto.accounts_id) || 1;
    const remark = dto.remark || '';
    const staff = Number(dto.staff_member_id) || admin_id;
    const now = Math.floor(Date.now() / 1000);
    if (!customers_id || money <= 0) return { error: '参数错误：客户与金额必填' };
    try {
      await this.conn.transaction(async (m) => {
        const purchase_code = this.code('SK');
        const r: any = await m.query(
          `INSERT INTO kuyou_collection (admin_id,customers_id,money,write_off,remarks,staff_member_id,preparation_id,examine_id,examine_status,examine_time,purchase_time,createtime,updatetime)
           VALUES (?,?,?,?,?,?,?,?,1,?,?,?,?)`,
          [admin_id, customers_id, money, money, remark, staff, admin_id, admin_id, now, now, now, now],
        );
        const cid = r.insertId;
        await m.query(
          `INSERT INTO kuyou_collection_account (admin_id,collection_id,purchase_code,purchase_time,accounts_id,money)
           VALUES (?,?,?,?,?,?)`,
          [admin_id, cid, purchase_code, now, accounts_id, money],
        );
        await m.query(
          `UPDATE kuyou_customers SET need_receive_account = GREATEST(0, need_receive_account - ?), account_time=? WHERE id=?`,
          [money, now, customers_id],
        );
        await m.query(
          `INSERT INTO kuyou_accounts_receivable (admin_id,customers_id,purchase_time,purchase_code,business_type,receivable_money,real_money,remark)
           VALUES (?,?,?,?,9,?,?,?)`,
          [admin_id, customers_id, now, purchase_code, money, money, remark],
        );
        const acc: any = await m.query(`SELECT account_coding, account_name, balance FROM kuyou_accounts WHERE id=?`, [accounts_id]);
        const bal = (Number(acc[0]?.balance) || 0) + money;
        await m.query(`UPDATE kuyou_accounts SET balance=? WHERE id=?`, [bal, accounts_id]);
        await m.query(
          `INSERT INTO kuyou_accounts_log (admin_id,account_coding,account_name,balance,income,pay_time,bill_code,business_type,customers_id,remark)
           VALUES (?,?,?,?,?,?,?,7,?,?)`,
          [admin_id, acc[0]?.account_coding || '', acc[0]?.account_name || '', bal, money, now, purchase_code, customers_id, remark],
        );
        await m.query(
          `INSERT INTO kuyou_operate_log (admin_id,module,action,content,createtime) VALUES (?,?,?,?,?)`,
          [admin_id, 'finance', 'collection', `收款单 ${purchase_code} 金额 ${money}`, now],
        );
      });
      return { code: 1, msg: '收款核销成功' };
    } catch (e: any) { return { code: 0, msg: '失败', error: e?.message || String(e) }; }
  }

  /** 新增并过账付款单 */
  async addPayment(dto: any) {
    const admin_id = dto.admin_id || 0;
    const suppliers_id = Number(dto.suppliers_id);
    const money = Number(dto.money) || 0;
    const accounts_id = Number(dto.accounts_id) || 1;
    const remark = dto.remark || '';
    const staff = Number(dto.staff_member_id) || admin_id;
    const now = Math.floor(Date.now() / 1000);
    if (!suppliers_id || money <= 0) return { error: '参数错误：供应商与金额必填' };
    try {
      await this.conn.transaction(async (m) => {
        const purchase_code = this.code('FK');
        const r: any = await m.query(
          `INSERT INTO kuyou_payment (admin_id,customers_id,money,write_off,remarks,staff_member_id,preparation_id,examine_id,examine_status,examine_time,purchase_time,createtime,updatetime)
           VALUES (?,?,?,?,?,?,?,?,1,?,?,?,?)`,
          [admin_id, suppliers_id, money, money, remark, staff, admin_id, admin_id, now, now, now, now],
        );
        const pid = r.insertId;
        await m.query(
          `INSERT INTO kuyou_payment_account (admin_id,collection_id,purchase_code,purchase_time,accounts_id,money)
           VALUES (?,?,?,?,?,?)`,
          [admin_id, pid, purchase_code, now, accounts_id, money],
        );
        await m.query(
          `UPDATE kuyou_suppliers SET need_give_account = GREATEST(0, need_give_account - ?), account_time=? WHERE id=?`,
          [money, now, suppliers_id],
        );
        await m.query(
          `INSERT INTO kuyou_accounts_copewith (admin_id,suppliers_id,purchase_time,purchase_code,business_type,receivable_money,real_money,remark)
           VALUES (?,?,?,?,9,?,?,?)`,
          [admin_id, suppliers_id, now, purchase_code, money, money, remark],
        );
        const acc: any = await m.query(`SELECT account_coding, account_name, balance FROM kuyou_accounts WHERE id=?`, [accounts_id]);
        const bal = (Number(acc[0]?.balance) || 0) - money;
        await m.query(`UPDATE kuyou_accounts SET balance=? WHERE id=?`, [bal, accounts_id]);
        await m.query(
          `INSERT INTO kuyou_accounts_log (admin_id,account_coding,account_name,balance,expenditure,pay_time,bill_code,business_type,remark)
           VALUES (?,?,?,?,?,?,?,8,?)`,
          [admin_id, acc[0]?.account_coding || '', acc[0]?.account_name || '', bal, money, now, purchase_code, remark],
        );
        await m.query(
          `INSERT INTO kuyou_operate_log (admin_id,module,action,content,createtime) VALUES (?,?,?,?,?)`,
          [admin_id, 'finance', 'payment', `付款单 ${purchase_code} 金额 ${money}`, now],
        );
      });
      return { code: 1, msg: '付款核销成功' };
    } catch (e: any) { return { code: 0, msg: '失败', error: e?.message || String(e) }; }
  }
}
