import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { DocumentService } from '../document/document.service';

/**
 * 零售收银台服务（源 retail/GoodsSales.php 的 retail 页与 _initialize）
 *
 * 覆盖源端 PC 收银台全部接口：
 *  - posInit        收银台初始化（公司名 / 结算账户 / 数量价格小数位）
 *  - getGoodsList   商品网格（关键字 / 分类 / 标签筛选，客户等级价，多单位与辅助属性，库存折算）
 *  - checkout       POS 结算（types=ls）：双单号、库存按仓分配、批次 / 序列号 / 多单位换算、
 *                  事务写入销货单主单 + 明细，必要时自动审核过账（联动库存与资金）
 *  - examineRetail  零售单审核 / 反审核（源 retail/goods_sales/examine?examine=1|2）
 *
 * 所有表名硬编码白名单，取值参数化；编号唯一性校验的库表名来自 kuyou_prefix 配置
 * （仅允许 kuyou_ 前缀且存在于 TABLE_META 的表）。
 */

/** 收银台开关设置缓存键 → kuyou_sets.name */
const SET_KEYS = ['serial', 'batch', 'auxiliary', 'taxes', 'price_taxes', 'examine', 'number_decimal', 'price_decimal', 'company_name'];

@Injectable()
export class RetailService {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    private readonly doc: DocumentService,
  ) {}

  /** 执行查询（表名均为白名单硬编码，取值参数化） */
  private query(sql: string, params: any[] = []) {
    return this.conn.query(sql, params);
  }

  private num(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private now(): number {
    return Math.floor(Date.now() / 1000);
  }

  /** 读取收银台相关系统设置（kuyou_sets：name → { value, is_checked }） */
  private async settings(): Promise<Record<string, any>> {
    const rows = await this.query(
      `SELECT \`name\`, \`value\`, \`is_checked\` FROM \`kuyou_sets\` WHERE \`name\` IN (${SET_KEYS.map(() => '?').join(',')})`,
      SET_KEYS,
    );
    const map: Record<string, any> = {};
    for (const r of rows) map[r.name] = r;
    return map;
  }

  /* ==================== 收银台初始化 ==================== */

  /**
   * 收银台初始化（源 retail() 视图赋值）
   * @returns { company_name, number_decimal, price_decimal, accounts }
   */
  async posInit() {
    const set = await this.settings();
    const accounts = await this.query('SELECT `id`, `account_name`, `is_default` FROM `kuyou_accounts`');
    return {
      company_name: set.company_name?.value ?? '',
      number_decimal: this.num(set.number_decimal?.value) || 1,
      price_decimal: this.num(set.price_decimal?.value) || 2,
      accounts,
    };
  }

  /* ==================== 商品网格 ==================== */

  /**
   * 商品网格列表（源 getGoodsList）
   * 关键字命中编号/名称/条码；分类含子级（path 模糊）；标签模糊；仅上架商品；
   * 客户等级决定价格档（1 零售 / 2 批发 / 3 会员 / 4、5 零售×折扣）；
   * 每个商品带出多单位价格（unit_data）与辅助属性价格（attr_data）。
   * @param q { keyword, goods_type_id, tag, customers_id, page, limit }
   * @returns { list, count }
   */
  async getGoodsList(q: any) {
    const page = Math.max(1, parseInt(String(q.page ?? 1), 10) || 1);
    const limit = Math.max(1, parseInt(String(q.limit ?? 24), 10) || 24);

    const where: string[] = ['`g`.`status` = ?'];
    const params: any[] = ['1'];
    const keyword = String(q.keyword ?? '').trim();
    if (keyword) {
      where.push('(`g`.`goods_code` LIKE ? OR `g`.`goods_name` LIKE ? OR `g`.`goods_barcode` LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    const typeId = this.num(q.goods_type_id);
    if (typeId) {
      // 分类含子级：path 中存「,id,」形态的祖链
      const sub = await this.query('SELECT `id` FROM `kuyou_goods_type` WHERE `path` LIKE ?', [`%,${typeId},%`]);
      const ids = [typeId, ...sub.map((r: any) => this.num(r.id))];
      where.push(`\`g\`.\`goods_type_id\` IN (${ids.map(() => '?').join(',')})`);
      params.push(...ids);
    }
    const tag = String(q.tag ?? '').trim();
    if (tag) {
      where.push('`g`.`tag` LIKE ?');
      params.push(`%${tag}%`);
    }
    const whereSql = ' WHERE ' + where.join(' AND ');

    const countRow = await this.query(`SELECT COUNT(*) AS \`c\` FROM \`kuyou_goods\` \`g\`${whereSql}`, params);
    const total = Number(countRow[0]?.c || 0);
    const list = await this.query(
      `SELECT \`g\`.\`id\`, \`g\`.\`goods_code\`, \`g\`.\`goods_type_id\`, \`g\`.\`goods_name\`, \`g\`.\`goods_barcode\`, \`g\`.\`note\`,
              \`g\`.\`goods_specification_id\` AS \`goods_spec\`, \`g\`.\`unit_id\`, \`u\`.\`name\` AS \`unit_name\`, \`g\`.\`more_unit\`,
              \`g\`.\`purchase\`, \`g\`.\`market_sell_price\`, \`g\`.\`wholesale_price\`, \`g\`.\`vip_price\`,
              \`g\`.\`discount\`, \`g\`.\`discount2\`, \`g\`.\`goods_image\`, \`g\`.\`inventory\` AS \`stock\`
       FROM \`kuyou_goods\` \`g\` JOIN \`kuyou_unit\` \`u\` ON \`g\`.\`unit_id\` = \`u\`.\`id\`${whereSql}
       ORDER BY \`g\`.\`sale_number\` DESC, \`g\`.\`id\` DESC LIMIT ${(page - 1) * limit}, ${limit}`,
      params,
    );

    // 客户等级 → 价格档
    let level = 0;
    const customersId = this.num(q.customers_id);
    if (customersId) {
      const cust = (await this.query('SELECT `customerlevel_id` FROM `kuyou_customers` WHERE `id` = ?', [customersId]))[0];
      level = this.num(cust?.customerlevel_id);
    }

    for (const row of list) {
      const unitData = await this.getGoodsUnit(this.num(row.id));
      const attrData = await this.getGoodsAuxiliary(this.num(row.id));
      // 等级价应用到单位行与属性行（源 getGoodsList 的 switch）
      for (const u of unitData) u.market_sell_price = this.levelPrice(level, u);
      for (const a of attrData) a.market_sell_price = this.levelPrice(level, a);
      row.unit_data = unitData;
      row.attr_data = attrData;
      // 列表级价格取第一个单位行（与源一致）
      row.purchase = unitData[0]?.purchase ?? 0;
      row.market_sell_price = unitData[0]?.market_sell_price ?? 0;
      row.wholesale_price = unitData[0]?.wholesale_price ?? 0;
      row.vip_price = unitData[0]?.vip_price ?? 0;
      row.discount = unitData[0]?.discount ?? 0;
      row.discount2 = unitData[0]?.discount2 ?? 0;
      // 多单位商品：单位名拼接换算进率（源 more_unit 分支）
      if (this.num(row.more_unit) === 1 && unitData.length > 1) {
        const names = unitData.map((u: any) => u.name).join(',');
        const rates = ['1', ...unitData.filter((u: any) => this.num(u.is_default) !== 1).map((u: any) => String(u.advance_rate ?? ''))].join(':');
        row.unit_name = `${names}(${rates})`;
      }
    }
    return { list, count: total };
  }

  /** 客户等级价（源 getGoodsList switch：1 零售 / 2 批发 / 3 会员 / 4、5 零售×折扣） */
  private levelPrice(level: number, row: any): number {
    switch (level) {
      case 2:
        return Number(row.wholesale_price || 0);
      case 3:
        return Number(row.vip_price || 0);
      case 4:
      case 5:
        return Math.round(Number(row.market_sell_price || 0) * Number(row.discount || 0) * 100) / 100;
      default:
        return Number(row.market_sell_price || 0);
    }
  }

  /**
   * 商品单位价格（源 getGoodsUnit）
   * 单单位商品返回主单位一行（辅助属性商品取属性价格）；
   * 多单位商品返回 kuyou_goods_price 全部单位行，库存按换算进率折算到辅单位。
   */
  private async getGoodsUnit(id: number): Promise<any[]> {
    const row = (
      await this.query(
        'SELECT `more_unit`,`unit_id`,`more_unit_id`,`purchase`,`market_sell_price`,`wholesale_price`,`vip_price`,`discount`,`discount2`,`auxiliary` FROM `kuyou_goods` WHERE `id` = ?',
        [id],
      )
    )[0];
    if (!row) return [];

    // 库存合计（全部属性维度）
    const stockRow = (await this.query('SELECT SUM(`stock`) AS `s` FROM `kuyou_goods_stock` WHERE `goods_id` = ?', [id]))[0];
    const stock = stockRow?.s == null ? 0 : Number(stockRow.s);

    let goodsPrice: any[];
    const rateMap: Record<string, number> = {};
    if (this.num(row.more_unit) !== 1) {
      let r: any = { ...row };
      if (this.num(row.auxiliary) === 1) {
        const ga = (
          await this.query(
            'SELECT `purchase`,`market_sell_price`,`wholesale_price`,`vip_price`,`discount`,`discount2` FROM `kuyou_goods_attr` WHERE `goods_id` = ?',
            [id],
          )
        )[0];
        if (ga) r = { ...r, ...ga };
      }
      const unitName = (await this.query('SELECT `name` FROM `kuyou_unit` WHERE `id` = ?', [row.unit_id]))[0]?.name || '';
      goodsPrice = [
        {
          unit: row.unit_id,
          purchase: r.purchase,
          market_sell_price: r.market_sell_price,
          wholesale_price: r.wholesale_price,
          vip_price: r.vip_price,
          discount: r.discount,
          discount2: r.discount2,
          is_default: 1,
          name: unitName,
        },
      ];
    } else {
      const mainUnit = row.more_unit_id;
      const conv = await this.query(
        'SELECT `vice_unit`, `advance_rate` FROM `kuyou_unit_conversion` WHERE `main_unit` = ? ORDER BY `advance_rate` ASC',
        [mainUnit],
      );
      for (const c of conv) rateMap[String(c.vice_unit)] = Number(c.advance_rate);
      goodsPrice = await this.query(
        'SELECT `g`.`unit`,`g`.`purchase`,`g`.`market_sell_price`,`g`.`wholesale_price`,`g`.`vip_price`,`g`.`discount`,`g`.`discount2`,`g`.`is_default`,`u`.`name` FROM `kuyou_goods_price` `g` JOIN `kuyou_unit` `u` ON `u`.`id` = `g`.`unit` WHERE `g`.`goods_id` = ? ORDER BY `g`.`is_default` DESC',
        [id],
      );
    }
    // 库存按换算率折算：主单位原值，辅单位除以进率
    for (const p of goodsPrice) {
      if (this.num(p.is_default) === 1) {
        p.stock = stock;
      } else {
        const rate = rateMap[String(p.unit)];
        p.stock = rate && rate !== 0 ? Math.round((stock / rate) * 100) / 100 : stock;
        p.advance_rate = rate ?? '';
      }
    }
    return goodsPrice;
  }

  /**
   * 商品辅助属性价格（源 getGoodsAuxiliary）
   * 属性组合名由 kuyou_aux_combination.attr_ids（& 分隔）映射 kuyou_auxiliary 名称后以 / 拼接。
   */
  private async getGoodsAuxiliary(id: number): Promise<any[]> {
    const aux = await this.query('SELECT `id`, `name` FROM `kuyou_auxiliary` WHERE `status` = 1');
    const auxMap: Record<string, string> = {};
    for (const a of aux) auxMap[String(a.id)] = a.name;
    const rows = await this.query(
      'SELECT `id`,`attribute_id`,`attr_code`,`barcode`,`unit`,`purchase`,`market_sell_price`,`wholesale_price`,`vip_price`,`discount`,`discount2` FROM `kuyou_goods_attr` WHERE `goods_id` = ?',
      [id],
    );
    for (const r of rows) {
      const comb = (await this.query('SELECT `attr_ids` FROM `kuyou_aux_combination` WHERE `id` = ?', [r.attribute_id]))[0];
      r.attr_name = '';
      if (comb && comb.attr_ids) {
        r.attr_name = String(comb.attr_ids)
          .split('&')
          .map((x: string) => auxMap[x] ?? x)
          .join('/');
      }
      r.market_sell_price = Number(r.market_sell_price || 0);
      r.wholesale_price = Number(r.wholesale_price || 0);
      r.vip_price = Number(r.vip_price || 0);
      r.discount = Number(r.discount || 0);
      r.discount2 = Number(r.discount2 || 0);
      delete r.attribute_id;
    }
    return rows;
  }

  /* ==================== POS 结算（types=ls） ==================== */

  /**
   * POS 结算（源 add 的 types=ls 分支）
   * 整体思路：校验客户与结算账户 → 取销货单号（prefix type 11）与零售单号（type 38） →
   * 校验商品行（编号/单位/属性不可重复、商品存在、辅助属性必选）→ 按仓分配库存并展开
   * 批次 / 序列号 / 多单位换算行 → 事务写入 kuyou_goods_sales 主单与 kuyou_goods_sales_info
   * 明细（含批次子表与序列号状态回写）→ 未开启审核流时自动审核过账（库存/资金联动），
   * 审核失败则删除刚生成的整单。
   * @param body { customers_id, account_id, all_money(实收), note, goods_list(JSON 字符串) }
   * @param user 当前登录用户（制单人 / 审核人）
   * @returns { purchase_code, date, cname }
   */
  async checkout(body: any, user: any) {
    const customersId = this.num(body.customers_id);
    if (!customersId) throw new BadRequestException('请选择客户');
    const customer = (await this.query('SELECT * FROM `kuyou_customers` WHERE `id` = ?', [customersId]))[0];
    if (!customer) throw new BadRequestException('此手机号未注册');

    const accountId = this.num(body.account_id);
    if (!accountId) throw new BadRequestException('请选择结算账户');
    const account = (await this.query('SELECT `id` FROM `kuyou_accounts` WHERE `id` = ?', [accountId]))[0];
    if (!account) throw new BadRequestException('未找到账户信息');

    const set = await this.settings();
    const purchaseCode = await this.getCodes(11);
    if (!purchaseCode) throw new BadRequestException('销货单单号获取失败');
    const orderCode = await this.getCodes(38);
    if (!orderCode) throw new BadRequestException('零售单单号获取失败');

    // 当天 0 点（源 strtotime(date('Y-m-d'))）
    const d0 = new Date();
    const purchaseTime = Math.floor(new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()).getTime() / 1000);
    const now = this.now();
    const adminId = user?.uid ?? user?.id ?? null;

    // 商品行解析与校验
    let goodsData: any[] = [];
    try {
      goodsData = JSON.parse(String(body.goods_list || '[]'));
    } catch {
      throw new BadRequestException('商品数据解析失败');
    }
    if (!Array.isArray(goodsData) || !goodsData.length) throw new BadRequestException('商品数据解析失败');
    for (const v of goodsData) {
      const dup = goodsData.filter(
        (x) =>
          x.goods_code === v.goods_code &&
          String(x.goods_unit ?? '') === String(v.goods_unit ?? '') &&
          String(x.goods_attr ?? '') === String(v.goods_attr ?? ''),
      ).length;
      if (dup > 1) throw new BadRequestException('同一笔销货单不可存在相同单位,属性的商品');
    }
    for (const v of goodsData) {
      const goods = (await this.query('SELECT `id`, `goods_name`, `auxiliary` FROM `kuyou_goods` WHERE `goods_code` = ?', [v.goods_code]))[0];
      if (!goods) throw new BadRequestException('商品数据错误');
      if (this.num(goods.auxiliary) === 1 && this.num(set.auxiliary?.is_checked) === 1 && !v.goods_attr) {
        throw new BadRequestException(`${goods.goods_name}必须选择商品属性`);
      }
    }

    // 库存分配 + 行数据展开（源 setGoodsData）
    const built = await this.buildGoodsData(goodsData, set);
    if (built.status !== 1) throw new BadRequestException(built.msg);
    const lines = built.data || [];
    let number = 0;
    let allMoney = 0;
    let taxMoney = 0;
    let moneyTaxPrice = 0;
    for (const l of lines) {
      number += Number(l.number || 0);
      allMoney += Number(l.all_money || 0);
      taxMoney += Number(l.tax_money || 0);
      moneyTaxPrice += Number(l.money_tax_price || 0);
    }

    // 主单：零售单（order_*）与销货单（purchase_*）双标识写在同一行
    const header: Record<string, any> = {
      purchase_code: purchaseCode,
      order_code: orderCode,
      order_time: now,
      order_type: 2,
      purchase_type: 1,
      purchase_time: purchaseTime,
      customers_id: customer.id,
      sale_user: 0,
      receiving_address: customer.getgoods_address ?? '',
      customers_money: 0,
      number,
      all_money: allMoney,
      tax_money: taxMoney,
      money_tax_price: moneyTaxPrice,
      preferential_rate: 0,
      preferential_money: 0,
      real_money: moneyTaxPrice,
      purchase_money: 0,
      note: body.note ?? '',
      arrears: 0,
      all_arrears: 0,
      pay_status: 1,
      pay_money: Number(body.all_money || 0),
      account: accountId,
      cost_data: null,
      preparation_id: adminId,
      operation_id: adminId,
      createtime: now,
      updatetime: now,
    };

    const saleId = await this.conn.transaction(async (em) => {
      const run = (sql: string, params: any[] = []) => em.query(sql, params);
      const cols = Object.keys(header);
      const ins = await run(
        `INSERT INTO \`kuyou_goods_sales\` (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(',')})`,
        cols.map((c) => header[c]),
      );
      const id = ins.insertId;
      // 明细整体替换（同单号历史行先清）
      await run('DELETE FROM `kuyou_goods_sales_info` WHERE `purchase_code` = ?', [purchaseCode]);
      for (const raw of lines) {
        const line = { ...raw };
        const serialCode: string[] = line.serial_code || [];
        const batchInfo = line.goods_batch_info || null;
        delete line.serial_code;
        delete line.goods_batch_info;
        delete line.period;
        line.purchase_code = purchaseCode;
        line.purchase_type = 1;
        line.purchase_time = purchaseTime;
        line.customers_id = customer.id;
        line.sale_user = 0;
        line.receiving_address = customer.getgoods_address ?? '';
        const lcols = Object.keys(line);
        const lins = await run(
          `INSERT INTO \`kuyou_goods_sales_info\` (${lcols.map((c) => `\`${c}\``).join(', ')}) VALUES (${lcols.map(() => '?').join(',')})`,
          lcols.map((c) => line[c]),
        );
        const infoId = lins.insertId;
        // 批次子表
        if (batchInfo) {
          batchInfo.purchase_info_id = infoId;
          const bcols = Object.keys(batchInfo);
          await run(
            `INSERT INTO \`kuyou_goods_batch_sale_info\` (${bcols.map((c) => `\`${c}\``).join(', ')}) VALUES (${bcols.map(() => '?').join(',')})`,
            bcols.map((c) => batchInfo[c]),
          );
        }
        // 序列号出库：状态置 3（已销售）并回写销售信息
        if (serialCode.length) {
          await run('UPDATE `kuyou_goods_serial` SET `status` = 3, `sale_id` = ?, `sale_code` = ? WHERE `serial` IN (' + serialCode.map(() => '?').join(',') + ')', [
            infoId,
            purchaseCode,
            ...serialCode,
          ]);
        }
      }
      return id;
    });

    // 自动审核过账：未开启审核流（examine 关闭）时直接过账，联动库存与资金
    if (this.num(set.examine?.is_checked) !== 1) {
      try {
        await this.doc.audit('kuyou_retail_sales', saleId, 1, user);
      } catch (e: any) {
        // 过账失败：删除刚生成的整单（库存/资金由审核事务自行回滚）
        await this.query('DELETE FROM `kuyou_goods_sales_info` WHERE `purchase_code` = ?', [purchaseCode]);
        await this.query('DELETE FROM `kuyou_goods_sales` WHERE `id` = ?', [saleId]);
        throw new BadRequestException(e?.message || '过账失败');
      }
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
      purchase_code: purchaseCode,
      date: `${d0.getFullYear()}-${months[d0.getMonth()]}-${String(d0.getDate()).padStart(2, '0')}`,
      cname: customer.customer_name ?? '',
    };
  }

  /**
   * 库存分配与明细行展开（源 setGoodsData）
   * 整体思路：逐商品按「含税/不含税」口径计算单价与税额 → 按仓分配库存
   * （多仓拆行）→ 批次商品按批次库存再拆分 → 序列号商品按仓取可用序列号 →
   * 多单位商品按换算进率算基础数量 → 组装明细行字段。
   * @param goodsData 前端提交的商品行 [{ goods_code, goods_unit, goods_attr, number, price }]
   * @param set 系统设置（序列号/批次/税金开关与税率）
   * @returns { status: 1, data } | { status: 0, msg }
   */
  private async buildGoodsData(
    goodsData: any[],
    set: Record<string, any>,
  ): Promise<{ status: number; data?: any[]; msg?: string }> {
    const serialOn = this.num(set.serial?.is_checked) === 1;
    const batchOn = this.num(set.batch?.is_checked) === 1;
    const taxesOn = this.num(set.taxes?.is_checked) === 1;
    const taxesRate = this.num(set.taxes?.value);

    // 默认账户：is_default=1，否则取第一个
    let account = (await this.query('SELECT `id` FROM `kuyou_accounts` WHERE `is_default` = 1'))[0];
    if (!account) account = (await this.query('SELECT `id` FROM `kuyou_accounts`'))[0];
    if (!account) return { status: 0, msg: '未查询到可用账户' };

    const out: any[] = [];
    for (const v of goodsData) {
      const goods = (await this.query('SELECT * FROM `kuyou_goods` WHERE `goods_code` = ?', [v.goods_code]))[0];
      if (!goods) return { status: 0, msg: '商品数据错误' };
      const number = Number(v.number || 0);

      // 单价 / 税额：接口提交金额按价税合计处理
      let unitPrice: number;
      let taxIncluded: number;
      let rate = 0;
      if (taxesOn) {
        taxIncluded = Number(v.price || 0);
        unitPrice = (taxIncluded * 100) / (100 + taxesRate);
        rate = taxesRate;
      } else {
        unitPrice = Number(v.price || 0);
        taxIncluded = unitPrice;
      }
      const allMoney = unitPrice * number;
      const moneyTaxPrice = taxIncluded * number;
      const taxMoney = moneyTaxPrice - allMoney;

      // 库存分配：按仓拆行，不足即拒
      const attrId = this.num(v.goods_attr);
      let stockWhere = '`goods_code` = ?';
      const stockParams: any[] = [v.goods_code];
      if (attrId > 0) {
        stockWhere += ' AND `attribute_id` = ?';
        stockParams.push(attrId);
      }
      const stockRows = await this.query(`SELECT * FROM \`kuyou_goods_stock\` WHERE ${stockWhere}`, stockParams);
      if (!stockRows.length) return { status: 0, msg: `${goods.goods_name}商品库存不足` };
      const allowStock = stockRows.reduce((s: number, r: any) => s + Number(r.stock || 0), 0);
      let need = number;
      const stockArr: any[] = [];
      for (const s of stockRows) {
        if (need <= 0) break;
        if (need < Number(s.stock)) {
          stockArr.push({ stores_id: s.stores_id, number: need });
          need = 0;
        } else {
          stockArr.push({ stores_id: s.stores_id, number: Number(s.stock) });
          need -= Number(s.stock);
        }
      }
      if (need > 0) return { status: 0, msg: `${goods.goods_name}商品库存不足` };

      // 批次商品：按批次库存再拆分
      if (this.num(goods.batch) === 1 && batchOn) {
        const batchArr: any[] = [];
        for (const sa of stockArr) {
          const bsWhere = ['`goods_id` = ?', '`stores_id` = ?'];
          const bsParams: any[] = [goods.id, sa.stores_id];
          if (attrId > 0) {
            bsWhere.push('`attribute_id` = ?');
            bsParams.push(attrId);
          }
          const batchStock = await this.query(`SELECT * FROM \`kuyou_goods_batch_stock\` WHERE ${bsWhere.join(' AND ')}`, bsParams);
          if (!batchStock.length) return { status: 0, msg: '批次信息查询失败' };
          let needBatch = sa.number;
          for (const bs of batchStock) {
            if (needBatch <= 0) break;
            const batch = (await this.query('SELECT * FROM `kuyou_goods_batch` WHERE `id` = ?', [bs.batch_id]))[0];
            if (!batch) return { status: 0, msg: '批次信息查询失败' };
            const take = needBatch < Number(bs.stock) ? needBatch : Number(bs.stock);
            batchArr.push({
              stores_id: bs.stores_id,
              batch_id: bs.batch_id,
              number: take,
              batch_name: batch.batch_name,
              manufacture: batch.manufacture,
              guarantee: batch.guarantee,
              validity: batch.validity,
            });
            needBatch -= take;
          }
        }
        stockArr.length = 0;
        stockArr.push(...batchArr);
      }

      // 序列号商品：按仓取可用序列号
      const serialByStore: Record<string, string[]> = {};
      if (this.num(goods.serial) === 1 && serialOn) {
        for (const sa of stockArr) {
          const sWhere = ['`goods_id` = ?', '`stores_id` = ?', '`store_status` = 1'];
          const sParams: any[] = [goods.id, sa.stores_id];
          if (attrId > 0) {
            sWhere.push('`attribute_id` = ?');
            sParams.push(attrId);
          }
          const serials = await this.query(
            `SELECT \`id\`, \`serial\`, \`remark\` FROM \`kuyou_goods_serial\` WHERE ${sWhere.join(' AND ')} LIMIT ${Math.floor(sa.number)}`,
            sParams,
          );
          if (serials.length !== Math.floor(sa.number)) return { status: 0, msg: '商品可用序列号不足' };
          serialByStore[String(sa.stores_id)] = serials.map((x: any) => x.serial);
        }
      }

      // 多单位换算进率（主单位 → 下单单位）
      let advanceRate = 1;
      if (this.num(goods.more_unit) === 1) {
        const mainUnit = goods.more_unit_id;
        const conv = await this.query(
          'SELECT `vice_unit`, `advance_rate` FROM `kuyou_unit_conversion` WHERE `main_unit` = ? ORDER BY `advance_rate` ASC',
          [mainUnit],
        );
        const rateMap: Record<string, number> = { [String(goods.unit_id)]: 1 };
        for (const c of conv) rateMap[String(c.vice_unit)] = Number(c.advance_rate);
        advanceRate = rateMap[String(v.goods_unit)] ?? 1;
      }

      for (const sa of stockArr) {
        const serialCode = serialByStore[String(sa.stores_id)] || [];
        // 批次子表信息（随明细行插入 kuyou_goods_batch_sale_info）
        let batchInfo: any = null;
        if (sa.batch_id !== undefined) {
          batchInfo = {
            batch_id: sa.batch_id ?? 0,
            goods_id: goods.id,
            goods_code: goods.goods_code,
            attribute_id: attrId,
            goods_unit: v.goods_unit,
            stores_id: sa.stores_id,
            stock: sa.number,
            number: sa.number,
            batch_name: sa.batch_name ?? '',
            manufacture: sa.manufacture ?? null,
            guarantee: sa.guarantee ?? null,
            validity: sa.validity ?? null,
            status: '0',
            type: 2,
            createtime: this.now(),
            updatetime: this.now(),
          };
        }
        out.push({
          goods_code: v.goods_code,
          goods_note: goods.note ?? '',
          goods_unit: v.goods_unit,
          stores_id: sa.stores_id,
          allow_stock: allowStock,
          number: sa.number,
          default_unit: goods.unit_id,
          basic_nmber: sa.number * advanceRate,
          unit_price: unitPrice,
          cost_price: 0,
          discount: 0,
          dis_money: 0,
          all_money: allMoney,
          remark: '',
          goods_attr: v.goods_attr ?? '',
          tax_included: taxIncluded,
          tax_rate: rate,
          tax_money: taxMoney,
          money_tax_price: moneyTaxPrice,
          batch_id: sa.batch_id ?? 0,
          batch_name: sa.batch_name ?? '',
          manufacture: sa.manufacture ?? null,
          guarantee: sa.guarantee ?? null,
          validity: sa.validity ?? null,
          preferential_rate: 0,
          preferential_money: 0,
          real_money: moneyTaxPrice,
          purchase_money: 0,
          pay_status: 1,
          pay_money: moneyTaxPrice,
          account: account.id,
          createtime: this.now(),
          updatetime: this.now(),
          goods_batch_info: batchInfo,
          serial_code: serialCode,
        });
      }
    }
    return { status: 1, data: out };
  }

  /* ==================== 零售单审核 ==================== */

  /**
   * 零售单审核 / 反审核（源 retail/goods_sales/examine?examine=1|2）
   * 走单据引擎的零售配置（kuyou_retail_sales → kuyou_goods_sales, order_type=2 固定过滤）。
   * @param ids   主键（逗号分隔）
   * @param state 1=审核 0=反审核
   * @param user  当前用户
   * @returns 成功条数
   */
  async examineRetail(ids: string, state: 0 | 1, user: any) {
    const list = String(ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    if (!list.length) throw new BadRequestException('请选择要审核的数据');
    let count = 0;
    for (const id of list) {
      await this.doc.audit('kuyou_retail_sales', id, state, user);
      count += 1;
    }
    return { affected: count };
  }

  /**
   * 零售单列表富化：回填退货关联单号 returns_order_id（对齐源 index 的 saleexc 关联）。
   * 源逻辑：kuyou_goods_saleexc.purchase_id = 零售单 id → exchange_id →
   *         kuyou_goods_sales_exchange.purchase_code 拼接。表缺失时跳过不报错。
   * @param rows 零售单列表行
   */
  async enrichReturnsOrderId(rows: any[]): Promise<any[]> {
    if (!rows || !rows.length) return rows;
    const ids = rows.map((r) => r.id).filter(Boolean);
    if (!ids.length) return rows;
    let link: any[] = [];
    try {
      link = await this.query(
        'SELECT `purchase_id`, `exchange_id` FROM `kuyou_goods_saleexc` WHERE `purchase_id` IN (?)',
        [ids],
      );
    } catch {
      return rows; // 关联表不存在则原样返回
    }
    if (!link.length) return rows;
    const exIds = [...new Set(link.map((l) => l.exchange_id).filter(Boolean))];
    let codes: Record<number, string> = {};
    if (exIds.length) {
      try {
        const ex = await this.query(
          'SELECT `id`, `purchase_code` FROM `kuyou_goods_sales_exchange` WHERE `id` IN (?)',
          [exIds],
        );
        codes = Object.fromEntries(ex.map((e: any) => [Number(e.id), e.purchase_code]));
      } catch {
        /* 忽略 */
      }
    }
    const byId = new Map<number, string[]>();
    for (const l of link) {
      const key = Number(l.purchase_id);
      if (!byId.has(key)) byId.set(key, []);
      const code = codes[Number(l.exchange_id)];
      if (code) byId.get(key)!.push(code);
    }
    for (const r of rows) {
      const arr = byId.get(Number(r.id));
      r.returns_order_id = arr && arr.length ? arr.join(',') : '';
    }
    return rows;
  }

  /* ==================== 单据编号 ==================== */

  /**
   * 取单据编号（源 Goods::getCodes）
   * 规则：kuyou_prefix 按 type 取前缀配置 → 数字位递补到 start → 前缀拼日期段
   * （year/month/day/hour/minute/second 开关）→ 左侧补零到 strlen → 配置了
   * dbname/field 时校验唯一，冲突则递补重取。
   * @param type 编号类型（11=销货单号，38=零售单号）
   * @param code 当前最大编号（首轮传空）
   */
  private async getCodes(type: number, code = ''): Promise<string> {
    const set = (await this.query('SELECT * FROM `kuyou_prefix` WHERE `type` = ?', [type]))[0];
    if (!set) return '';
    const digits = String(code || '').replace(/\D+/g, '');
    let orderNum = digits === '' ? 0 : parseFloat(digits);
    if (orderNum < this.num(set.start)) orderNum = this.num(set.start);
    else orderNum = orderNum + 1;

    let prefix = String(set.prefix || '');
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    if (this.num(set.year) === 1) prefix += d.getFullYear();
    if (this.num(set.month) === 1) prefix += pad(d.getMonth() + 1);
    if (this.num(set.day) === 1) prefix += pad(d.getDate());
    if (this.num(set.hour) === 1) prefix += pad(d.getHours());
    if (this.num(set.minute) === 1) prefix += pad(d.getMinutes());
    if (this.num(set.second) === 1) prefix += pad(d.getSeconds());

    const numStr = String(orderNum);
    const zeros = '0'.repeat(Math.max(0, this.num(set.strlen) - numStr.length));
    const full = `${prefix}${zeros}${numStr}`;

    // 唯一性校验：dbname/field 来自管理端配置，仅允许 kuyou_ 前缀表
    if (set.dbname && set.field && /^kuyou_[a-z_]+$/.test(String(set.dbname)) && /^[a-z_]+$/.test(String(set.field))) {
      const exist = (await this.query(`SELECT \`id\` FROM \`${set.dbname}\` WHERE \`${set.field}\` = ?`, [full]))[0];
      if (exist) return this.getCodes(type, numStr);
    }
    return full;
  }
}
