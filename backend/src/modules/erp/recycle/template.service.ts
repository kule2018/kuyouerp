import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

/**
 * 单据模板服务（对应源 Assemble::savetemp / Split::savetemp 与 *_temp::gettemp）
 *
 * 组装/拆卸单可把当前录入内容另存为模板，后续通过模板快速带出全部明细：
 * - savetemp：校验模板名唯一 → 逐行校验单位/仓库/批次/序列号 → 主表 + 明细表两处落库
 * - gettemp：按模板 ID 取回主表与明细（明细联商品表补 goods_name）
 *
 * 首行（k=0）为组合件/主件（type=1），其余为子件（type=2），与源一致。
 */

/** 模板配置：主表 / 明细表 / 业务类型 */
const TEMP_CONF: Record<string, { main: string; info: string; businessType: number }> = {
  assemble: { main: 'kuyou_assemble_temp', info: 'kuyou_assemble_info_temp', businessType: 1 },
  split: { main: 'kuyou_split_temp', info: 'kuyou_split_info_temp', businessType: 2 },
};

@Injectable()
export class TemplateService {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  /** 执行查询（表名均为白名单硬编码，取值参数化） */
  query(sql: string, params: any[] = []) {
    return this.conn.query(sql, params);
  }

  private num(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private now(): number {
    return Math.floor(Date.now() / 1000);
  }

  /** 日期字符串或 Excel 序列号 → 秒级时间戳 */
  private toTs(v: any, fallback = 0): number {
    if (v === undefined || v === null || v === '') return fallback;
    if (typeof v === 'number') return Math.round((v - 25569) * 86400);
    const s = String(v).trim();
    if (/^\d+(\.\d+)?$/.test(s)) return Math.round((Number(s) - 25569) * 86400);
    const t = Math.floor(new Date(`${s.slice(0, 10)}T00:00:00`).getTime() / 1000);
    return Number.isFinite(t) ? t : fallback;
  }

  /**
   * 保存单据模板
   * @param biz   assemble | split
   * @param tempName 模板名称（须唯一）
   * @param row  表单行数据（字段多为数组：goods_code[] / goods_unit[] / number[] ...）
   * @param adminId 当前操作员 ID
   * @returns 新模板主键
   */
  async savetemp(biz: string, tempName: string, row: Record<string, any>, adminId: number) {
    const conf = TEMP_CONF[biz];
    if (!conf) throw new BadRequestException('不支持的模板类型');
    const name = String(tempName || '').trim();
    if (!name) throw new BadRequestException('请输入模板名称');
    if (!row) throw new BadRequestException('参数不能为空');
    const dup = await this.query(`SELECT \`id\` FROM \`${conf.main}\` WHERE \`temp_name\` = ?`, [name]);
    if (dup.length) throw new BadRequestException('模板名称不能重复');
    if (!row.purchase_code) throw new BadRequestException('请填写单据编号');

    // 系统设置：序列号 / 批次开关
    const set = await this.query('SELECT `name`, `is_checked` FROM `kuyou_sets` WHERE `name` IN (?)', [['serial', 'batch']]);
    const setMap: Record<string, number> = {};
    for (const s of set) setMap[s.name] = Number(s.is_checked);
    const useSerial = setMap['serial'] === 1;
    const useBatch = setMap['batch'] === 1;

    const codes: any[] = Array.isArray(row.goods_code) ? row.goods_code : [row.goods_code];
    const now = this.now();
    const purchaseTime = this.toTs(row.purchase_time, now);
    const data: any[] = [];
    const serialAll: string[] = [];
    let hasParent = false;
    let hasChild = false;

    for (let k = 0; k < codes.length; k++) {
      const code = codes[k];
      if (code === undefined || code === null || code === '') continue;
      // 单位与仓库必选
      if (!this.pick(row.goods_unit, k)) throw new BadRequestException('请选择单位');
      if (!this.pick(row.stores_id, k)) throw new BadRequestException('请选择仓库');

      const goods = (await this.query('SELECT * FROM `kuyou_goods` WHERE `goods_code` = ?', [code]))[0];
      if (!goods) throw new BadRequestException('商品信息查询失败');
      const goodsUnit = this.num(this.pick(row.goods_unit, k));

      // 多单位换算：所选单位不是默认单位时取换算进率，算基础数量
      let advanceRate = 1;
      if (Number(goods.more_unit) === 1 && goodsUnit !== Number(goods.unit_id)) {
        const more = (
          await this.query('SELECT `id`, `advance_rate` FROM `kuyou_unit_conversion` WHERE `main_unit` = ? AND `vice_unit` = ?', [
            goods.unit_id,
            goodsUnit,
          ])
        )[0];
        if (!more) throw new BadRequestException('商品单位信息查询失败');
        advanceRate = this.num(more.advance_rate);
      }
      let basicNumber = this.num(this.num(this.pick(row.number, k)) * advanceRate);
      const isParent = k === 0;

      // 批次校验（商品启用批次且系统开启批次时）
      if (Number(goods.batch) === 1 && useBatch) {
        if (!this.pick(row.batch, k)) throw new BadRequestException('请输入生产批次');
        if (!this.pick(row.manufacture, k)) throw new BadRequestException('请输入生产日期');
        if (this.pick(row.guarantee, k) === '' || this.pick(row.guarantee, k) === undefined) {
          throw new BadRequestException('请输入保质期');
        }
        if (this.num(this.pick(row.guarantee, k)) < 0) throw new BadRequestException('保质期天数不可小于0');
        if (!this.pick(row.validity, k)) throw new BadRequestException('请输入过期时间');
        if (!isParent && !this.pick(row.batch_id, k)) throw new BadRequestException('商品批次信息查询失败');
      }

      // 序列号校验：父件查占用，子件查在库
      let goodsSerial = '';
      const serialRaw = this.pick(row.period_period, k);
      if (serialRaw !== undefined && serialRaw !== null && serialRaw !== '' && Number(goods.serial) === 1 && useSerial) {
        if (!serialRaw) throw new BadRequestException('请输入商品序列号');
        goodsSerial = String(serialRaw);
        const list: any[] = Array.isArray(serialRaw) ? serialRaw : this.parseSerial(serialRaw);
        const serialCodes: string[] = list.map((x: any) => String(x && x.serial ? x.serial : x));
        for (const sc of serialCodes) {
          if (serialAll.indexOf(sc) >= 0) throw new BadRequestException(`商品序列号${sc}重复`);
          serialAll.push(sc);
        }
        if (isParent) {
          const used = await this.query('SELECT `serial` FROM `kuyou_goods_serial` WHERE `serial` IN (?)', [serialCodes]);
          if (used.length) throw new BadRequestException(`商品序列号${used[0].serial}已占用`);
        } else {
          const instore = await this.query('SELECT `serial` FROM `kuyou_goods_serial` WHERE `serial` IN (?) AND `store_status` = 1', [
            serialCodes,
          ]);
          if (instore.length !== serialCodes.length) {
            for (const sc of serialCodes) {
              if (!instore.find((r: any) => String(r.serial) === sc)) {
                throw new BadRequestException(`商品序列号${sc}不在库，不可出库`);
              }
            }
            throw new BadRequestException('商品序列号不在库，不可出库');
          }
        }
        basicNumber = this.num(this.pick(row.number, k));
      }

      data.push({
        purchase_code: row.purchase_code,
        purchase_time: purchaseTime,
        business_type: conf.businessType,
        type: isParent ? 1 : 2,
        goods_id: goods.id,
        goods_code: goods.goods_code,
        goods_attr: this.nullable(row.goods_attr, k),
        goods_unit: this.nullable(row.goods_unit, k),
        stores_id: this.nullable(row.stores_id, k),
        allow_stock: this.nullable(row.allow_stock, k),
        number: this.nullable(row.number, k),
        period: goodsSerial || null,
        basic_number: basicNumber,
        unit_cost: this.nullable(row.unit_cost, k),
        cost_money: this.nullable(row.cost_money, k),
        remark: this.pick(row.remark, k) === '' || this.pick(row.remark, k) === undefined ? null : this.pick(row.remark, k),
        batch: this.pick(row.batch, k) === '' || this.pick(row.batch, k) === undefined ? null : this.pick(row.batch, k),
        batch_id: this.nullable(row.batch_id, k),
        manufacture: this.pick(row.manufacture, k) ? this.toTs(this.pick(row.manufacture, k), 0) || null : null,
        guarantee: this.nullable(row.guarantee, k),
        validity: this.pick(row.validity, k) ? this.toTs(this.pick(row.validity, k), 0) || null : null,
        preparation_id: adminId,
        operation_id: adminId,
        createtime: now,
        updatetime: now,
      });
      if (isParent) hasParent = true;
      else hasChild = true;
    }

    if (!hasParent) throw new BadRequestException('组合件信息不能为空');
    if (!hasChild) throw new BadRequestException('组合子件信息不能为空');
    if (!data.length) throw new BadRequestException('组件信息不能为空');

    const result = await this.query(
      `INSERT INTO \`${conf.main}\` (\`temp_name\`, \`purchase_code\`, \`purchase_time\`, \`business_type\`, \`money\`, \`remark\`, \`preparation_id\`, \`operation_id\`, \`createtime\`, \`updatetime\`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        row.purchase_code,
        purchaseTime,
        conf.businessType,
        row.costs === '' || row.costs === undefined ? null : this.num(row.costs),
        row.note === '' || row.note === undefined ? null : row.note,
        adminId,
        adminId,
        now,
        now,
      ],
    );
    const tempId = result.insertId;
    for (const d of data) {
      d.purchase_id = tempId;
      await this.query(`INSERT INTO \`${conf.info}\` SET ?`, [d]);
    }
    return tempId;
  }

  /**
   * 取用模板：返回主表与明细（明细联商品补 goods_name）
   * @returns { info, temp }
   */
  async gettemp(biz: string, id: number | string) {
    const conf = TEMP_CONF[biz];
    if (!conf) throw new BadRequestException('不支持的模板类型');
    const temp = (await this.query(`SELECT * FROM \`${conf.main}\` WHERE \`id\` = ?`, [id]))[0];
    if (!temp) throw new BadRequestException('未查询到模板信息');
    const info = await this.query(
      `SELECT \`a\`.*, \`g\`.\`goods_name\` FROM \`${conf.info}\` \`a\` JOIN \`kuyou_goods\` \`g\` ON \`g\`.\`id\` = \`a\`.\`goods_id\` WHERE \`a\`.\`purchase_id\` = ?`,
      [id],
    );
    if (!info.length) throw new BadRequestException('未查询到模板信息');
    return { info, temp };
  }

  /** 取数组字段第 k 项（字段也可能是单值） */
  private pick(field: any, k: number): any {
    if (field === undefined || field === null) return undefined;
    if (Array.isArray(field)) return field[k];
    return k === 0 ? field : undefined;
  }

  /** 数组字段第 k 项转数值，空值转 null */
  private nullable(field: any, k: number): any {
    const v = this.pick(field, k);
    if (v === undefined || v === null || v === '') return null;
    return this.num(v);
  }

  /** 序列号字段：可能是 JSON 串或 & / , 分隔 */
  private parseSerial(raw: any): any[] {
    if (Array.isArray(raw)) return raw;
    const s = String(raw);
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      /* 非 JSON，按分隔符处理 */
    }
    return s
      .split(/[&,\s]+/)
      .filter((x) => x !== '')
      .map((x) => ({ serial: x }));
  }
}
