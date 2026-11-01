import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

/**
 * 客户价目表（kuyou_customer_goodscoding）服务逻辑
 *
 * 对齐源端 api/model/kuyou/applet/CustomerGoodscoding.php：
 *  - list / detail：联表返回（商品名称 / 客户名称 / 单位名称）
 *  - add：源端 addDetail，接收 customers_id + code_data(JSON 数组 [{goods_code, unit_id, customer_code?}])，
 *         逐条校验客户/商品/单位存在后批量写入
 *  - edit / del：单行更新 / 按 id 删除
 *
 * 安全：表名/列名来自本文件常量，筛选只走参数化。
 */
@Injectable()
export class CustomerGoodscodingService {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  private readonly SELECT = `
    cg.id, cg.customer_code,
    FROM_UNIXTIME(cg.createtime, '%Y-%m-%d %H:%i:%s') AS createtime,
    FROM_UNIXTIME(cg.updatetime, '%Y-%m-%d %H:%i:%s') AS updatetime,
    cg.goods_code, g.goods_name, cg.customers_id, c.customer_name, cg.unit_id, u.name AS unit_name
  `;
  private readonly FROM = `
    FROM kuyou_customer_goodscoding cg
    JOIN kuyou_goods g ON g.goods_code = cg.goods_code
    JOIN kuyou_customers c ON c.id = cg.customers_id
    JOIN kuyou_unit u ON u.id = cg.unit_id
  `;

  /** 列表（分页 + 客户/商品筛选，对齐源端 getList） */
  async list(params: {
    page?: number;
    limit?: number;
    customers_id?: any;
    goods_code?: string;
  }): Promise<{ list: any[]; count: number }> {
    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.max(1, Number(params.limit || 20));
    const where: string[] = [];
    const args: any[] = [];

    if (params.customers_id !== undefined && params.customers_id !== null && params.customers_id !== '') {
      where.push('cg.customers_id = ?');
      args.push(Number(params.customers_id));
    }
    if (params.goods_code) {
      where.push('cg.goods_code LIKE ?');
      args.push(`%${params.goods_code}%`);
    }
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

    const rows = await this.conn.query(
      `SELECT ${this.SELECT} ${this.FROM} ${whereSql} ORDER BY cg.id DESC LIMIT ?, ?`,
      [...args, (page - 1) * limit, limit],
    );
    const cnt = await this.conn.query(`SELECT COUNT(*) AS c ${this.FROM} ${whereSql}`, args);
    return { list: rows, count: Number(cnt[0]?.c || 0) };
  }

  /** 详情（联表，对齐源端 getDetail） */
  async detail(id: number): Promise<any> {
    const rows = await this.conn.query(
      `SELECT ${this.SELECT} ${this.FROM} WHERE cg.id = ? LIMIT 1`,
      [id],
    );
    if (!rows[0]) throw new BadRequestException('未查询到相关信息');
    return rows[0];
  }

  /**
   * 批量新增（对齐源端 addDetail）
   * @param body.customers_id 客户主键
   * @param body.code_data    [{ goods_code, unit_id, customer_code? }]
   */
  async add(body: { customers_id: number; code_data: any[] }): Promise<{ status: number; msg: any }> {
    const customersId = Number(body.customers_id);
    if (!customersId) throw new BadRequestException('参数错误：customers_id 必填');
    const codeData = Array.isArray(body.code_data) ? body.code_data : [];
    if (!codeData.length) throw new BadRequestException('参数错误：code_data 为空');

    const cust = await this.conn.query('SELECT id FROM kuyou_customers WHERE id = ? LIMIT 1', [customersId]);
    if (!cust[0]) throw new BadRequestException('客户不存在');

    const now = Math.floor(Date.now() / 1000);
    const cols = ['admin_id', 'customers_id', 'goods_code', 'unit_id', 'customer_code', 'createtime', 'updatetime'];
    const placeholders: string[] = [];
    const flat: any[] = [];

    for (const item of codeData) {
      const goodsCode = String(item?.goods_code ?? '').trim();
      const unitId = Number(item?.unit_id);
      if (!goodsCode) throw new BadRequestException('商品不存在：goods_code 为空');
      const goods = await this.conn.query('SELECT id FROM kuyou_goods WHERE goods_code = ? LIMIT 1', [goodsCode]);
      if (!goods[0]) throw new BadRequestException(`商品不存在：${goodsCode}`);
      const unit = await this.conn.query('SELECT id FROM kuyou_unit WHERE id = ? LIMIT 1', [unitId]);
      if (!unit[0]) throw new BadRequestException(`单位不存在：${unitId}`);
      placeholders.push('(?,?,?,?,?,?,?)');
      flat.push(null, customersId, goodsCode, unitId, String(item?.customer_code ?? '').trim(), now, now);
    }

    await this.conn.query(
      `INSERT INTO kuyou_customer_goodscoding (${cols.join(',')}) VALUES ${placeholders.join(',')}`,
      flat,
    );
    return { status: 200, msg: codeData.length };
  }

  /** 单行更新（对齐源端 editDetail） */
  async edit(body: any): Promise<{ status: number; msg: string }> {
    const id = Number(body?.id);
    if (!id) throw new BadRequestException('参数错误：id 必填');

    if (body.customers_id !== undefined) {
      const cust = await this.conn.query('SELECT id FROM kuyou_customers WHERE id = ? LIMIT 1', [Number(body.customers_id)]);
      if (!cust[0]) throw new BadRequestException('客户不存在');
    }
    if (body.goods_code !== undefined) {
      const goods = await this.conn.query('SELECT id FROM kuyou_goods WHERE goods_code = ? LIMIT 1', [String(body.goods_code)]);
      if (!goods[0]) throw new BadRequestException(`商品不存在：${body.goods_code}`);
    }
    if (body.unit_id !== undefined) {
      const unit = await this.conn.query('SELECT id FROM kuyou_unit WHERE id = ? LIMIT 1', [Number(body.unit_id)]);
      if (!unit[0]) throw new BadRequestException(`单位不存在：${body.unit_id}`);
    }

    const fields: Record<string, any> = {};
    for (const k of ['customer_code', 'customers_id', 'goods_code', 'unit_id']) {
      if (body[k] !== undefined) {
        fields[k] = k === 'customers_id' || k === 'unit_id' ? Number(body[k]) : String(body[k]);
      }
    }
    if (!Object.keys(fields).length) throw new BadRequestException('参数错误：无可更新字段');
    fields.updatetime = Math.floor(Date.now() / 1000);

    await this.conn.query('UPDATE kuyou_customer_goodscoding SET ? WHERE id = ?', [fields, id]);
    return { status: 200, msg: '更新成功' };
  }

  /** 删除（对齐源端 delDetail，支持数组批量） */
  async del(id: number | number[]): Promise<{ status: number; msg: any }> {
    const ids = (Array.isArray(id) ? id : [id]).map(Number).filter((x) => x);
    if (!ids.length) throw new BadRequestException('参数错误：id 必填');
    const res = await this.conn.query('DELETE FROM kuyou_customer_goodscoding WHERE id IN (?)', [ids]);
    return { status: 200, msg: res.affectedRows };
  }
}
