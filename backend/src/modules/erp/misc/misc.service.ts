import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { registerListEnricher } from '../dynamic-crud/list-enrichers';

/**
 * 零散业务服务（源系统中不便归入单据/联动/专项的端点）
 *
 * 覆盖内容：
 *  - 用户订单发货（status 状态机 + 司机/快递信息）
 *  - 地区树（kuyou_area）
 *  - 销售利润报表（index2）
 *  - 费用单金额明细预检（checkdata）
 *  - 附件上传（voucherAttachment）
 *
 * 所有 SQL 表名硬编码白名单，取值一律参数化。
 */

@Injectable()
export class MiscService {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  /** 执行查询（表名均为白名单硬编码，取值参数化） */
  query(sql: string, params: any[] = []) {
    return this.conn.query(sql, params);
  }

  private num(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private empty(v: any): boolean {
    return v === undefined || v === null || v === '' || v === '0' || v === 0;
  }

  private now(): number {
    return Math.floor(Date.now() / 1000);
  }

  /* ==================== 用户订单发货 ==================== */

  /**
   * 用户订单发货（源 UserOrder::deliver）
   * 状态机：0 未审核不可发货；2 需已生成销货单且（开启支付校验时）已支付；
   * 3 已发货 / 4 已收货不可重复发货。通过后把状态置 3，并按配送方式写司机或快递信息。
   *
   * @param ids  订单主键（逗号分隔）
   * @param body 发货信息：send_type=1 司机自送（diver_id）；否则快递（express_code/express_num）
   */
  async deliver(ids: string, body: Record<string, any>) {
    const list = String(ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    if (!list.length) throw new BadRequestException('参数错误');

    // 支付校验开关：pay_status=1 时必须已支付才可发货
    const paySet = (await this.query("SELECT `value` FROM `kuyou_user_config` WHERE `name` = 'pay_status'"))[0];
    const needPay = this.num(paySet?.value) === 1;

    const rows = await this.query(`SELECT * FROM \`kuyou_user_order\` WHERE \`id\` IN (${list.map(() => '?').join(',')})`, list);
    if (!rows.length) throw new BadRequestException('未查询到订单');

    let diverName = '';
    let diverPhone = '';
    const expressList = await this.query('SELECT `code`, `name` FROM `kuyou_express`');
    const expressMap: Record<string, string> = {};
    for (const e of expressList) expressMap[String(e.code)] = e.name;

    for (const v of rows) {
      const status = this.num(v.status);
      if (status === 0) throw new BadRequestException(`${v.order_num}未审核，不可发货`);
      if (status === 2) {
        const sale = (await this.query('SELECT `sales_id` FROM `kuyou_user_ordersale` WHERE `order_id` = ?', [v.id]))[0];
        if (!sale || !sale.sales_id) throw new BadRequestException(`${v.order_num}未生成销货单，不可发货`);
        if (needPay && this.num(v.pay_status) !== 1) throw new BadRequestException(`${v.order_num}未支付，不可发货`);
      } else if (status === 3) {
        throw new BadRequestException(`${v.order_num}已发货，不可重复发货`);
      } else if (status === 4) {
        throw new BadRequestException(`${v.order_num}已收货，不可重复发货`);
      } else if (status !== 2) {
        throw new BadRequestException(`${v.order_num}状态异常，不可发货`);
      }
    }

    // 司机自送时带出司机姓名与电话
    if (this.num(body.send_type) === 1) {
      const diver = (await this.query('SELECT `name`, `phone` FROM `kuyou_driver` WHERE `id` = ?', [body.diver_id]))[0];
      if (diver) {
        diverName = diver.name;
        diverPhone = diver.phone;
      }
    }

    let count = 0;
    for (const v of rows) {
      const data: Record<string, any> = { status: 3, updatetime: this.now() };
      if (this.num(body.send_type) === 1) {
        data.diver_id = this.num(body.diver_id);
        data.diver_name = diverName;
        data.diver_phone = diverPhone;
      } else {
        data.express_code = body.express_code ?? '';
        data.express_name = expressMap[String(body.express_code)] ?? '';
        data.express_num = body.express_num ?? '';
      }
      const setSql = Object.keys(data)
        .map((k) => `\`${k}\` = ?`)
        .join(',');
      const res = await this.query(`UPDATE \`kuyou_user_order\` SET ${setSql} WHERE \`id\` = ?`, [...Object.values(data), v.id]);
      count += res.affectedRows;
    }
    if (!count) throw new BadRequestException('发货失败');
    return { affected: count };
  }

  /* ==================== 用户订单审核 ==================== */

  /**
   * 用户订单审核（源 UserOrder::examine）
   * 仅 status=0 的订单可审核，通过后 status 置 2（待生成销货单）并刷新 updatetime。
   *
   * @param ids 订单主键（逗号分隔）
   * @returns 受影响行数
   */
  async userOrderExamine(ids: string) {
    const list = String(ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    if (!list.length) throw new BadRequestException('请选择要审核的数据');
    let count = 0;
    for (const id of list) {
      // 只翻未审核（status=0）的订单，重复审核不累计
      const res = await this.query('UPDATE `kuyou_user_order` SET `status` = 2, `updatetime` = ? WHERE `id` = ? AND `status` = 0', [
        this.now(),
        this.num(id),
      ]);
      count += res.affectedRows;
    }
    if (!count) throw new BadRequestException('审核失败');
    return { affected: count };
  }

  /* ==================== 用户订单列表富化 ==================== */

  /** 模块启动：把用户订单列表富化注册进通用 CRUD（源 UserOrder::index 的联表逻辑） */
  onModuleInit(): void {
    registerListEnricher('kuyou_user_order', (rows) => this.enrichUserOrders(rows));
  }

  /**
   * 用户订单列表富化（源 UserOrder::index）
   * 整体思路：与源 PHP 逐条对应——每个订单先带出销货单关联 sales_id、
   * 司机姓名与「到店自取」地址后缀，再按订货单明细把每个商品展开成一行
   * （订单级字段在行间重复，前端按 order_num 合并单元格）；无明细的订单不产生行。
   * @param rows 通用 CRUD 查出的订单原始行（当前页，已分页）
   * @returns 商品级展开行数组（total 仍为订单数，与源 paginate 语义一致）
   */
  private async enrichUserOrders(rows: any[]): Promise<any[]> {
    const out: any[] = [];
    for (const v of rows) {
      // 销货单关联：已生成销货单的订单带出 sales_id（发货/再生成的判断依据）
      const sale = (
        await this.query('SELECT `sales_id` FROM `kuyou_user_ordersale` WHERE `order_id` = ?', [v.id])
      )[0];
      // 到店自取（diver_type=2）：收货地址替换为门店地址并加「(自提)」后缀
      let address = v.address;
      if (this.num(v.diver_type) === 2 && !this.empty(v.store_id)) {
        const store = (await this.query('SELECT `detail_address` FROM `kuyou_address` WHERE `id` = ?', [v.store_id]))[0];
        if (store && store.detail_address) address = `${store.detail_address}(自提)`;
      }
      // 司机姓名实时反查（订单表上的 diver_name 可能未同步）
      let diverName = v.diver_name || '';
      if (!this.empty(v.diver_id)) {
        const driver = (await this.query('SELECT `name` FROM `kuyou_driver` WHERE `id` = ?', [v.diver_id]))[0];
        if (driver && driver.name) diverName = driver.name;
      }
      // 订货单明细：一行一个商品展开（源 PHP 的 goods_list 循环）
      const goodsList = await this.query('SELECT * FROM `kuyou_user_orderinfo` WHERE `order_id` = ? ORDER BY `id` ASC', [
        v.id,
      ]);
      for (const g of goodsList) {
        const goods = (await this.query('SELECT `goods_code` FROM `kuyou_goods` WHERE `id` = ?', [g.goods_id]))[0];
        out.push({
          id: v.id,
          sales_id: sale ? sale.sales_id : null,
          name: v.name,
          phone: v.phone,
          address,
          order_num: v.order_num,
          order_price: v.order_price,
          status: v.status,
          createtime: v.createtime,
          goods_code: goods ? goods.goods_code : '',
          goods_name: g.goods_name,
          goods_image: g.goods_image,
          unit_name: g.unit_name,
          attr_name: g.attr_name,
          number: g.number,
          price: g.price,
          money: g.money,
          pay_status: v.pay_status,
          diver_type: v.diver_type,
          diver_id: v.diver_id,
          diver_name: diverName,
        });
      }
    }
    return out;
  }

  /* ==================== 地区树 ==================== */

  /** 地区树（源 address/area，返回 id/pid/name 三级结构） */
  async area(pid: any = 0) {
    const rows = await this.query('SELECT `id`, `pid`, `name`, `level`, `shortname` FROM `kuyou_area` WHERE `pid` = ? ORDER BY `id` ASC', [
      this.num(pid),
    ]);
    return { total: rows.length, rows };
  }

  /* ==================== 销售利润 ==================== */

  /**
   * 销售利润报表（源 goods_sales_profit/index2）
   * 按商品汇总销售收入、成本与毛利，支持关键字与时间区间过滤。
   */
  async salesProfit(q: any) {
    const where: string[] = ['`s`.`examine_status` = 1'];
    const params: any[] = [];
    if (!this.empty(q.keyword)) {
      where.push('(`i`.`goods_code` LIKE ? OR `i`.`goods_name` LIKE ?)');
      params.push(`%${q.keyword}%`, `%${q.keyword}%`);
    }
    if (!this.empty(q.start_time)) {
      where.push('`s`.`purchase_time` >= ?');
      params.push(this.num(q.start_time));
    }
    if (!this.empty(q.end_time)) {
      where.push('`s`.`purchase_time` <= ?');
      params.push(this.num(q.end_time));
    }
    const rows = await this.query(
      `SELECT \`i\`.\`goods_code\`, \`i\`.\`goods_name\`, SUM(\`i\`.\`all_money\`) AS \`sale_money\`,
              SUM(\`i\`.\`cost_money\`) AS \`cost_money\`,
              SUM(\`i\`.\`all_money\`) - SUM(IFNULL(\`i\`.\`cost_money\`, 0)) AS \`profit\`,
              SUM(\`i\`.\`number\`) AS \`number\`
       FROM \`kuyou_goods_sales_info\` \`i\`
       JOIN \`kuyou_goods_sales\` \`s\` ON \`s\`.\`purchase_code\` = \`i\`.\`purchase_code\`
       WHERE ${where.join(' AND ')}
       GROUP BY \`i\`.\`goods_code\`, \`i\`.\`goods_name\`
       ORDER BY \`profit\` DESC`,
      params,
    );
    return { total: rows.length, rows };
  }

  /* ==================== 费用单明细预检 ==================== */

  /**
   * 费用单明细预检（源 cost/checkdata）
   * 源端返回的序列化串在这里直接以数组返回：校验每行金额与支出类别，并汇总金额。
   */
  async costCheckdata(body: Record<string, any>) {
    if (body.cost_data !== undefined && body.cost_data !== null && body.cost_data !== '') {
      const ser = Array.isArray(body.cost_data) ? body.cost_data : [];
      return { ser };
    }
    const cost = body.costs || {};
    const monies: any[] = Array.isArray(cost.money) ? cost.money : [];
    if (!monies.length) throw new BadRequestException('请输入金额');
    const types: any[] = Array.isArray(cost.expend_type_id) ? cost.expend_type_id : [];
    const suppliers: any[] = Array.isArray(cost.suppliers_id) ? cost.suppliers_id : [];
    const remarks: any[] = Array.isArray(cost.remark) ? cost.remark : [];
    const data: any[] = [];
    let money = 0;
    monies.forEach((v: any, k: number) => {
      if (this.empty(v)) return;
      if (this.empty(types[k])) throw new BadRequestException('请选择支出类别');
      money += this.num(v);
      data.push({
        suppliers_id: this.empty(suppliers[k]) ? null : suppliers[k],
        expend_type_id: types[k],
        money: this.num(v),
        remark: remarks[k] ?? '',
      });
    });
    return { money, ser: data };
  }

  /* ==================== 盘点导出 ==================== */

  /**
   * 盘点库存导出（源 Inventory::export）
   * 按 商品编码 + 属性 + 仓库 汇总系统库存，输出与源端表头一致的 xlsx：
   * 仓库 / 商品类别 / 商品编号 / 商品名称 / 属性编号 / 属性名称 / 规格型号 /
   * 单位 / 系统库存 / 盘点库存（空列，供线下填写）/ 商品条码。
   *
   * @returns xlsx 文件 Buffer
   */
  async inventoryExport(): Promise<Buffer> {
    // 1) 汇总层：按商品 + 属性组合 + 仓库聚合库存与成本（排除序列号商品 serial=1）
    const list = await this.query(
      'SELECT SUM(gs.`stock`) AS `stock`, gs.`goods_code`, gs.`attribute_id`, gs.`stores_id` ' +
        'FROM `kuyou_goods_stock` gs ' +
        'JOIN `kuyou_goods` g ON g.`id` = gs.`goods_id` ' +
        "WHERE g.`serial` <> '1' " +
        'GROUP BY gs.`goods_code`, gs.`attribute_id`, gs.`stores_id` ' +
        'ORDER BY gs.`goods_code` ASC',
    );
    // 2) 明细补齐：商品 / 分类 / 仓库 / 属性名 / 单位
    const rows: any[] = [];
    for (const v of list) {
      const goods = (
        await this.query(
          'SELECT `id`, `goods_barcode`, `goods_name`, `goods_code`, `goods_type_id`, `goods_specification_id`, `unit_id` ' +
            'FROM `kuyou_goods` WHERE `goods_code` = ?',
          [v.goods_code],
        )
      )[0];
      if (!goods) continue;
      const goodsType = (
        await this.query('SELECT `supplier_type_name` FROM `kuyou_goods_type` WHERE `id` = ?', [goods.goods_type_id])
      )[0];
      const stores = (await this.query('SELECT `name` FROM `kuyou_stores` WHERE `id` = ?', [v.stores_id]))[0];
      // 辅助属性组合 → 属性名（& 拼接的 ID 拆开后取名称）
      let attrName = '';
      const combo = (
        await this.query('SELECT `attr_ids` FROM `kuyou_aux_combination` WHERE `id` = ?', [v.attribute_id])
      )[0];
      if (combo?.attr_ids) {
        const ids = String(combo.attr_ids).split('&');
        const names = await this.query('SELECT `name` FROM `kuyou_auxiliary` WHERE `id` IN (?)', [ids]);
        attrName = names.map((n: any) => n.name).join('/');
      }
      const attrCode = (
        await this.query(
          'SELECT `attr_code` FROM `kuyou_goods_attr` WHERE `goods_code` = ? AND `attribute_id` = ?',
          [v.goods_code, v.attribute_id],
        )
      )[0];
      const unit = (await this.query('SELECT `name` FROM `kuyou_unit` WHERE `id` = ?', [goods.unit_id]))[0];
      rows.push({
        stores_name: stores?.name ?? '',
        type_name: goodsType?.supplier_type_name ?? '',
        goods_code: goods.goods_code,
        goods_name: goods.goods_name,
        attr_code: attrCode?.attr_code ?? '',
        attr_name: attrName,
        goods_spec: goods.goods_specification_id ?? '',
        unit_name: unit?.name ?? '',
        stock: v.stock,
        pstock: '',
        goods_barcode: goods.goods_barcode ?? '',
      });
    }
    // 3) 生成 xlsx（表头与源端一致）
    const XLSX = require('xlsx');
    const header = [
      '仓库',
      '商品类别',
      '商品编号',
      '商品名称',
      '属性编号',
      '属性名称',
      '规格型号',
      '单位',
      '系统库存',
      '盘点库存',
      '商品条码',
    ];
    const aoa: any[][] = [header];
    for (const r of rows) {
      aoa.push([
        r.stores_name,
        r.type_name,
        r.goods_code,
        r.goods_name,
        r.attr_code,
        r.attr_name,
        r.goods_spec,
        r.unit_name,
        r.stock,
        r.pstock,
        r.goods_barcode,
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '盘点');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  /* ==================== 附件上传 ==================== */

  /**
   * 附件上传（源 img/voucherAttachment、img/more）
   * 保存到 uploads 目录并返回可访问路径，与 ajax/upload 保持一致的返回结构。
   */
  async saveUpload(file: any): Promise<{ url: string; name: string }> {
    if (!file) throw new BadRequestException('未接收到上传文件');
    const dir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ext = path.extname(file.originalname || '').toLowerCase();
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}${ext}`;
    fs.writeFileSync(path.join(dir, name), file.buffer);
    return { url: `/uploads/${name}`, name: file.originalname };
  }
}
