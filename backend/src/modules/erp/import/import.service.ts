import { Injectable, BadRequestException, Optional } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { TABLE_COMMENTS } from '../../../table-comments';
import { TABLE_META } from '../../../table-meta';
import { DocumentService } from '../document/document.service';

/**
 * 基础资料 Excel 导入服务（对应源系统各控制器 import 方法）
 *
 * 与源系统一致的行为约定：
 * 1. 表头行：多数模板第 2 行为表头、第 3 行起为数据；职员/仓库/盘点模板第 1 行为表头、第 2 行起为数据。
 * 2. 表头中的 * 号表示必填，读取时统一剔除（源：str_replace('*','')）。
 * 3. 编号类字段重复一律中止导入（源：$this->error('导入失败，xx编号重复')）。
 * 4. editstatus：0=编号已存在即报错；1=编号已存在则更新（源默认 1）。
 * 5. 返回 { add, update } 供前端展示「新增 N 条 / 更新 M 条」。
 *
 * 所有 SQL 表名硬编码白名单，取值一律参数化。
 */

/** 单条导入结果 */
export interface ImportResult {
  add: number;
  update: number;
}

@Injectable()
export class ImportService {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    @Optional() private readonly docSvc?: DocumentService,
  ) {}

  /** 执行查询（表名均为白名单硬编码，取值参数化） */
  query(sql: string, params: any[] = []) {
    return this.conn.query(sql, params);
  }

  private num(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private round(v: number, p = 2): number {
    const f = 10 ** p;
    return Math.round(v * f) / f;
  }

  private now(): number {
    return Math.floor(Date.now() / 1000);
  }

  /* ==================== 文件解析 ==================== */

  /**
   * 解析表格文件为「表头 → 值」对象数组
   * @param filePath 上传文件绝对路径（csv / xls / xlsx 均可）
   * @param headRow  表头所在行号（1 起）
   * @param dataStart 数据起始行号（1 起）
   * @returns 每行构成的对象数组，键为表头文本（已剔除 * 号）
   */
  parse(filePath: string, headRow: number, dataStart: number): Record<string, any>[] {
    if (!fs.existsSync(filePath)) throw new BadRequestException('未找到上传文件');
    const book = XLSX.readFile(filePath, { cellDates: true });
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet) throw new BadRequestException('未找到上传文件');
    const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
    const head = (matrix[headRow - 1] || []).map((v: any) => String(v ?? '').replace(/\*/g, '').trim());
    const rows: Record<string, any>[] = [];
    for (let i = dataStart - 1; i < matrix.length; i++) {
      const line = matrix[i] || [];
      const obj: Record<string, any> = {};
      let empty = true;
      for (let c = 0; c < head.length; c++) {
        const val = line[c] === undefined || line[c] === null ? '' : line[c];
        if (val !== '' && val !== null) empty = false;
        obj[head[c]] = val;
      }
      if (!empty) rows.push(obj);
    }
    return rows;
  }

  /**
   * 单元格值 → 秒级时间戳（对应源 PHPExcel_Shared_Date::excelToTimeStamp）
   * 数字按 Excel 序列号换算；字符串按本地零时解析；空值返回当前时间。
   */
  private toTs(v: any): number {
    if (v === '' || v === null || v === undefined) return this.now();
    if (typeof v === 'number') return Math.round((v - 25569) * 86400);
    if (v instanceof Date) return Math.floor(v.getTime() / 1000);
    const s = String(v).trim();
    if (s === '') return this.now();
    if (/^\d+(\.\d+)?$/.test(s)) return Math.round((Number(s) - 25569) * 86400);
    const t = Math.floor(new Date(`${s.slice(0, 10)}T00:00:00`).getTime() / 1000);
    return Number.isFinite(t) ? t : this.now();
  }

  /** 取表格中以某前缀开头的列（如「期初数量-主仓」） */
  private suffixKeys(row: Record<string, any>, prefix: string): string[] {
    return Object.keys(row).filter((k) => k.indexOf(prefix) === 0);
  }

  /* ==================== 导入入口 ==================== */

  /**
   * 按实体分发导入
   * @param entity 实体名（customers / suppliers / goods / staff_member / stores /
   *               customer_goodscoding / inventory / factory / workshop）
   * @param file   上传的相对路径（如 /uploads/xxx.xlsx）
   * @param editstatus 0=禁止更新 1=允许更新
   * @param skulist  商品导入时选定的辅助属性名列表
   */
  async run(entity: string, file: string, editstatus: number, skulist: any[] = []): Promise<ImportResult> {
    const abs = path.join(process.cwd(), 'uploads', path.basename(String(file || '')));
    switch (entity) {
      case 'customers':
        return this.customers(abs, editstatus);
      case 'suppliers':
        return this.suppliers(abs, editstatus);
      case 'goods':
        return this.goods(abs, editstatus, skulist);
      case 'staff_member':
        return this.staffMember(abs, editstatus);
      case 'stores':
        return this.stores(abs, editstatus);
      case 'customer_goodscoding':
        return this.customerGoodscoding(abs, editstatus);
      case 'inventory':
        return this.inventory(abs);
      case 'factory':
        return this.factory(abs, editstatus);
      case 'workshop':
        return this.workshop(abs, editstatus);
      default:
        // 未编写专用导入的表走通用导入（按列注释映射表头）
        return this.generic(entity, abs, editstatus);
    }
  }

  /* ==================== 客户 ==================== */

  /**
   * 客户导入（源 Customers::import）
   * 必填：客户编号 / 客户名称 / 联系人；客户类别、客户等级、销售人员须已存在。
   * 每个联系人行写入 kuyou_customers_user，期初余额写入核销源与收付款流水。
   */
  async customers(filePath: string, editstatus: number): Promise<ImportResult> {
    const insert = this.parse(filePath, 2, 3);
    if (!insert.length) throw new BadRequestException('未查询到数据');

    // 逐行清洗：缺编号/名称/联系人的行直接丢弃（与源一致）
    const rows: Record<string, any>[] = [];
    const cate: string[] = [];
    const level: string[] = [];
    const saler: string[] = [];
    for (const v of insert) {
      if (this.empty(v['客户编号']) || this.empty(v['客户名称']) || this.empty(v['联系人'])) continue;
      rows.push(v);
      this.pushUniq(cate, v['客户类别']);
      this.pushUniq(level, v['客户等级']);
      this.pushUniq(saler, v['销售人员']);
    }
    if (!rows.length) throw new BadRequestException('未查询到数据');

    // 字典校验：分类 / 等级 / 销售人员必须已存在
    const catelist = await this.nameMap('kuyou_customertype', 'type_name', cate, '客户分类');
    const levellist = await this.nameMap('kuyou_customerlevel', 'name', level, '客户等级');
    const salerlist = await this.codeMap('kuyou_staff_member', 'men_code', saler, '职员');

    // 组装：一个客户编号对应一条主记录 + 多个联系人
    const params: any[] = [];
    const seen: string[] = [];
    const now = this.now();
    for (const v of rows) {
      const code = String(v['客户编号']);
      if (seen.indexOf(code) >= 0) throw new BadRequestException(`导入失败，客户编号${code}重复`);
      seen.push(code);
      const receive = this.num(v['期初应收款']);
      const prepay = this.num(v['期初预收款']);
      const item: any = {
        customer_code: code,
        customer_name: v['客户名称'],
        customertype_id: catelist[v['客户类别']] ?? null,
        customerlevel_id: levellist[v['客户等级']] ?? 1,
        staff_member_id: salerlist[v['销售人员']] ?? null,
        account_time: this.toTs(v['余额日期']),
        receive_account: receive,
        opening_prepayment: prepay,
        need_receive_account: this.round(receive - prepay, 4),
        identification: v['纳税人识别号'] ?? '',
        deposit_bank: v['开户银行'] ?? '',
        bank_number: v['银行账号'] ?? '',
        connet_name: v['联系人'] ?? '',
        customer_mobile: v['手机'] ?? '',
        customer_phone: v['座机'] ?? '',
        qq_wx_email: v['QQ/微信'] ?? '',
        getgoods_address: v['联系地址'] ?? '',
        createtime: now,
        updatetime: now,
        userlist: [],
        _first: 0,
      };
      // 首要联系人：整行首个标记「是」的联系人
      const isFirst = v['首要联系人'] === '是' && item._first === 0 ? 1 : 0;
      if (isFirst) item._first = 1;
      item.userlist.push({
        customers_code: code,
        first_connect_name: v['联系人'] ?? '',
        first_connect_mobile: v['手机'] ?? '',
        first_connect_phone: v['座机'] ?? '',
        qq_wx_email: v['QQ/微信'] ?? '',
        connect_address: v['联系地址'] ?? '',
        is_first: isFirst,
        createtime: now,
        updatetime: now,
      });
      params.push(item);
    }

    // 已存在编号处理：0=报错 1=转为更新集合
    const exist = await this.query('SELECT `id`, `customer_code` FROM `kuyou_customers` WHERE `customer_code` IN (?)', [seen]);
    const existMap: Record<string, number> = {};
    for (const e of exist) existMap[e.customer_code] = e.id;
    if (editstatus === 0) {
      for (const code of seen) {
        if (existMap[code] !== undefined) throw new BadRequestException(`导入失败，客户编号${code}已存在`);
      }
    }
    const update: any[] = [];
    const add: any[] = [];
    for (const p of params) {
      if (existMap[p.customer_code] !== undefined && editstatus === 1) {
        p.id = existMap[p.customer_code];
        update.push(p);
      } else {
        add.push(p);
      }
    }

    // 落库：主表 + 联系人 + 期初核销源 + 收付款流水
    for (const p of add) {
      const userarr = p.userlist;
      delete p.userlist;
      delete p._first;
      const res = await this.query('INSERT INTO `kuyou_customers` SET ?', [p]);
      const id = res.insertId;
      await this.insertCustomerOpening(id, p);
      if (userarr.length) {
        for (const u of userarr) u.sid = id;
        await this.insertAll('kuyou_customers_user', userarr);
      }
    }
    for (const p of update) {
      const userarr = p.userlist;
      delete p.userlist;
      delete p._first;
      const id = p.id;
      delete p.id;
      delete p.createtime;
      await this.query('UPDATE `kuyou_customers` SET ? WHERE `id` = ?', [p, id]);
      // 更新时先清旧期初再重写（与源 delete + insert 一致）
      await this.query('DELETE FROM `kuyou_writeoff_source` WHERE `customers_id` = ? AND `type` = 3', [id]);
      await this.query('DELETE FROM `kuyou_sales_payment_log` WHERE `bill_code` = ? AND `business_type` IN (5, 6)', [p.customer_code]);
      await this.insertCustomerOpening(id, p);
      if (userarr.length) {
        for (const u of userarr) u.sid = id;
        await this.insertAll('kuyou_customers_user', userarr);
      }
    }
    return { add: add.length, update: update.length };
  }

  /** 客户期初：>0 记应收（purchase_type 5），<0 记预收（6），并写收付款流水 */
  private async insertCustomerOpening(id: number, p: any) {
    const money = this.num(p.need_receive_account);
    if (money === 0) return;
    const type = money > 0 ? 5 : 6;
    await this.query(
      `INSERT INTO \`kuyou_writeoff_source\` (\`purchase_type\`, \`type\`, \`customers_id\`, \`purchase_code\`, \`purchase_time\`, \`price\`, \`write_off\`) VALUES (?, 3, ?, ?, ?, ?, ?)`,
      [type, id, p.customer_code, p.account_time, money, money],
    );
    await this.query(
      `INSERT INTO \`kuyou_sales_payment_log\` (\`customers_id\`, \`business_type\`, \`bill_time\`, \`bill_code\`, \`give_money\`) VALUES (?, ?, ?, ?, ?)`,
      [id, type, p.account_time, p.customer_code, money],
    );
  }

  /* ==================== 供应商 ==================== */

  /**
   * 供应商导入（源 Suppliers::import）
   * 必填：供应商编号 / 供应商名称 / 联系人，且手机与座机至少一个非空。
   */
  async suppliers(filePath: string, editstatus: number): Promise<ImportResult> {
    const insert = this.parse(filePath, 2, 3);
    if (!insert.length) throw new BadRequestException('未查询到数据');

    const rows: Record<string, any>[] = [];
    const cate: string[] = [];
    for (const v of insert) {
      if (this.empty(v['联系人'])) continue;
      if (this.empty(v['手机']) && this.empty(v['座机'])) continue;
      rows.push(v);
      this.pushUniq(cate, v['供应商类别']);
    }
    if (!rows.length) throw new BadRequestException('未查询到数据');
    const catelist = await this.nameMap('kuyou_supplyertype', 'supplier_type_name', cate, '供应商类别');

    const params: any[] = [];
    const seen: string[] = [];
    const now = this.now();
    let cur: any = null;
    for (const v of rows) {
      if (!this.empty(v['供应商编号']) && !this.empty(v['供应商名称'])) {
        const code = String(v['供应商编号']);
        if (seen.indexOf(code) >= 0) throw new BadRequestException(`导入失败，供应商编号${code}重复`);
        seen.push(code);
        const payable = this.num(v['期初应付款']);
        const prepay = this.num(v['期初预付款']);
        cur = {
          supplyer_code: code,
          supplyer_name: v['供应商名称'],
          supplyertype_id: catelist[v['供应商类别']] ?? 0,
          account_time: this.toTs(v['余额日期']),
          opening_payable: payable,
          opening_prepayment: prepay,
          need_give_account: this.round(payable - prepay, 2),
          vat_rate: this.num(v['增值税税率']),
          identification: v['纳税人识别号'] ?? '',
          deposit_bank: v['开户银行'] ?? '',
          bank_number: v['银行账号'] ?? '',
          note: v['备注'] ?? '',
          first_connect_name: v['联系人'] ?? '',
          first_connect_mobile: v['手机'] ?? '',
          first_connect_phone: v['座机'] ?? '',
          qq_wx_email: v['QQ/微信'] ?? '',
          connect_address: v['联系地址'] ?? '',
          createtime: now,
          updatetime: now,
          userlist: [],
        };
        params.push(cur);
      }
      // 联系人行（首行 is_first=1，续行 0）
      if (cur) {
        cur.userlist.push({
          supplyer_code: cur.supplyer_code,
          first_connect_name: v['联系人'] ?? '',
          first_connect_mobile: v['手机'] ?? '',
          first_connect_phone: v['座机'] ?? '',
          qq_wx_email: v['QQ/微信'] ?? '',
          connect_address: v['联系地址'] ?? '',
          is_first: cur.userlist.length === 0 ? 1 : 0,
          createtime: now,
          updatetime: now,
        });
      }
    }

    const exist = await this.query('SELECT `id`, `supplyer_code` FROM `kuyou_suppliers` WHERE `supplyer_code` IN (?)', [seen]);
    const existMap: Record<string, number> = {};
    for (const e of exist) existMap[e.supplyer_code] = e.id;
    if (editstatus === 0) {
      for (const code of seen) {
        if (existMap[code] !== undefined) throw new BadRequestException(`导入失败，供应商编号${code}已存在`);
      }
    }
    const add: any[] = [];
    const update: any[] = [];
    for (const p of params) {
      if (existMap[p.supplyer_code] !== undefined && editstatus === 1) {
        p.id = existMap[p.supplyer_code];
        update.push(p);
      } else {
        add.push(p);
      }
    }

    for (const p of add) {
      const userarr = p.userlist;
      delete p.userlist;
      const res = await this.query('INSERT INTO `kuyou_suppliers` SET ?', [p]);
      await this.insertSupplierOpening(p);
      if (userarr.length) {
        for (const u of userarr) u.sid = res.insertId;
        await this.insertAll('kuyou_suppliers_user', userarr);
      }
    }
    for (const p of update) {
      const userarr = p.userlist;
      delete p.userlist;
      const id = p.id;
      delete p.id;
      delete p.createtime;
      await this.query('UPDATE `kuyou_suppliers` SET ? WHERE `id` = ?', [p, id]);
      await this.query('DELETE FROM `kuyou_writeoff_source` WHERE `suppliers_code` = ? AND `type` = 3', [p.supplyer_code]);
      await this.query('DELETE FROM `kuyou_payment_log` WHERE `suppliers_code` = ? AND `business_type` IN (5, 6)', [p.supplyer_code]);
      await this.insertSupplierOpening(p);
      if (userarr.length) {
        for (const u of userarr) u.sid = id;
        await this.insertAll('kuyou_suppliers_user', userarr);
      }
    }
    return { add: add.length, update: update.length };
  }

  /** 供应商期初：>0 记应付（purchase_type 5），<0 记预付（6），并写付款流水 */
  private async insertSupplierOpening(p: any) {
    const money = this.num(p.need_give_account);
    if (money === 0) return;
    const type = money > 0 ? 5 : 6;
    await this.query(
      `INSERT INTO \`kuyou_writeoff_source\` (\`purchase_type\`, \`type\`, \`suppliers_code\`, \`purchase_code\`, \`purchase_time\`, \`price\`, \`write_off\`) VALUES (?, 3, ?, ?, ?, ?, ?)`,
      [type, p.supplyer_code, p.supplyer_code, p.account_time, money, money],
    );
    await this.query(
      `INSERT INTO \`kuyou_payment_log\` (\`suppliers_code\`, \`business_type\`, \`bill_time\`, \`bill_code\`, \`give_money\`) VALUES (?, ?, ?, ?, ?)`,
      [p.supplyer_code, type, p.account_time, p.supplyer_code, money],
    );
  }

  /* ==================== 商品 ==================== */

  /**
   * 商品导入（源 Goods::import）
   * 处理链路：辅助属性列 → 属性组合 → 分类自动建档 → 计量单位/换算率自动建档 →
   * 价格体系（多单位按 / 拆分）→ 各仓库期初数量与单位成本 → 主表 + 价格/库存/期初/属性四张子表。
   */
  async goods(filePath: string, editstatus: number, skulist: any[] = []): Promise<ImportResult> {
    const insert = this.parse(filePath, 2, 3);
    if (!insert.length) throw new BadRequestException('未查询到数据');

    // 无编号且无条码的行视为属性续行之外的空行，直接丢弃
    const rows = insert.filter((v) => !this.empty(v['商品编号']) || !this.empty(v['商品/属性条码']));
    if (!rows.length) throw new BadRequestException('未查询到数据');

    /* --- 辅助属性：把表头上的属性名列映射为属性 ID，再组合成 attr_arr --- */
    const attrNames: string[] = [];
    if (skulist && skulist.length) {
      const aux = await this.query('SELECT `id`, `name` FROM `kuyou_auxiliary` WHERE `id` IN (?)', [skulist]);
      const auxName: Record<string, string> = {};
      for (const a of aux) auxName[a.id] = String(a.name);
      for (const s of skulist) {
        const nm = auxName[String(s)];
        if (!nm) throw new BadRequestException('商品属性查询错误，导入失败');
        if (!(nm in rows[0])) throw new BadRequestException(`请输入属性‘${nm}’信息`);
        attrNames.push(nm);
      }
    }
    if (attrNames.length) {
      const aux = await this.query('SELECT `id`, `name` FROM `kuyou_auxiliary` WHERE `name` IN (?)', [attrNames]);
      const auxId: Record<string, number> = {};
      for (const a of aux) auxId[a.name] = a.id;
      for (const nm of attrNames) {
        if (auxId[nm] === undefined) throw new BadRequestException(`辅助属性${nm}不存在`);
      }
      for (const row of rows) {
        const types: number[] = [];
        const ids: number[] = [];
        for (const nm of attrNames) {
          if (!this.empty(row[nm])) {
            types.push(auxId[nm]);
            ids.push(auxId[nm]);
          }
        }
        row.auxiliary = types.length ? 1 : 0;
        row.auxiliary_type = types.join(',');
        row.auxiliary_type_c = ids.join(',');
        row.attr_arr = '';
        if (ids.length) {
          const sorted = [...ids].sort((a, b) => a - b);
          const key = sorted.join('&');
          const exist = await this.query('SELECT `id` FROM `kuyou_aux_combination` WHERE `attr_ids` = ? AND `attr_code` = ?', [key, row['属性编号'] ?? '']);
          if (exist.length) {
            row.attr_arr = exist[0].id;
          } else {
            const now = this.now();
            const res = await this.query(
              'INSERT INTO `kuyou_aux_combination` (`attr_ids`, `attr_code`, `createtime`, `updatetime`) VALUES (?, ?, ?, ?)',
              [key, row['属性编号'] ?? '', now, now],
            );
            row.attr_arr = res.insertId;
          }
        }
      }
    } else {
      for (const row of rows) {
        row.auxiliary = 0;
        row.auxiliary_type = '';
        row.auxiliary_type_c = '';
        row.attr_arr = '';
      }
    }

    /* --- 商品分类：不存在的自动建档（支持 A/B/C 多级） --- */
    const cate: string[] = [];
    const cateData: string[] = [];
    for (const v of rows) {
      if (!this.empty(v['商品类别'])) {
        const c = String(v['商品类别']).trim();
        cateData.push(c);
        for (const one of c.split('/')) {
          if (one && cate.indexOf(one) < 0) cate.push(one);
        }
      }
    }
    const catelist = await this.nameMap('kuyou_goods_type', 'supplier_type_name', cate, '商品分类', true);
    for (const c of cate) {
      if (catelist[c] === undefined) await this.addGoodsCate(cateData, c);
    }
    const cateMap = await this.nameMap('kuyou_goods_type', 'supplier_type_name', cate, '商品分类', true);

    /* --- 仓库：模板中「期初数量-仓库名」列解析出来的仓库必须已存在 --- */
    const stores: string[] = [];
    for (const v of rows) this.pushUniq(stores, v['首选仓库']);
    const heads = Object.keys(rows[0] || {});
    for (const h of heads) {
      if (h.indexOf('期初数量') === 0) {
        const nm = h.split('-')[1];
        if (nm && stores.indexOf(nm) < 0) stores.push(nm);
      }
    }
    const storeMap = await this.nameMap('kuyou_stores', 'name', stores, '仓库');

    /* --- 计量单位：多单位按「单位/单位」+ 换算率自动建档 --- */
    const unitInfo: Record<string, number> = {};
    for (const v of rows) {
      const raw = String(v['计量单位'] ?? '').trim();
      if (!raw) continue;
      if (raw.indexOf('/') >= 0) {
        if (this.empty(v['换算率'])) throw new BadRequestException('多计量单位的换算率必填');
        const names = raw.split('/');
        const rates = String(v['换算率']).trim().split('/');
        if (names.length !== rates.length) throw new BadRequestException('多计量单位的换算率与计量单位不匹配');
        // 主单位
        let mainUnit = await this.unitIdByName(names[0]);
        const ids: number[] = [mainUnit];
        for (let i = 1; i < names.length; i++) {
          const viceUnit = await this.unitIdByName(names[i], false);
          const rate = this.num(rates[i]);
          const conv = await this.query('SELECT `id` FROM `kuyou_unit_conversion` WHERE `unit_name` = ? AND `advance_rate` = ?', [`${names[0]}/${names[i]}`, rate]);
          let convId: number;
          if (conv.length) {
            convId = conv[0].id;
          } else {
            const now = this.now();
            const res = await this.query(
              'INSERT INTO `kuyou_unit_conversion` (`unit_name`, `main_unit`, `vice_unit`, `advance_rate`, `createtime`, `updatetime`) VALUES (?, ?, ?, ?, ?, ?)',
              [`${names[0]}/${names[i]}`, mainUnit, viceUnit, rate, now, now],
            );
            convId = res.insertId;
          }
          ids.push(viceUnit);
          if (i === 1) unitInfo[raw] = convId;
        }
        v._unit_ids = ids;
        v._unit_main = mainUnit;
      } else {
        const uid = await this.unitIdByName(raw);
        unitInfo[raw] = uid;
        v._unit_ids = [uid];
        v._unit_main = uid;
      }
    }

    /* --- 组装主记录与子表数据 --- */
    const params: any[] = [];
    const goodsCodes: string[] = [];
    const now = this.now();
    let cur: any = null;
    for (const v of rows) {
      if (!this.empty(v['商品编号'])) {
        if (this.empty(v['预计采购价'])) throw new BadRequestException('请输入商品预计采购价');
        if (this.empty(v['零售价'])) throw new BadRequestException('请输入商品零售价');
        if (this.empty(v['计量单位'])) throw new BadRequestException('请输入商品计量单位');
        if (goodsCodes.indexOf(String(v['商品编号'])) >= 0) {
          // 同编号重复出现时后一条覆盖前一条（源 unset 后重建）
          params.splice(goodsCodes.indexOf(String(v['商品编号'])), 1);
        }
        goodsCodes.push(String(v['商品编号']));

        // 价格体系：按单位逐个拆 / 分隔的值
        const units = String(v['计量单位']).split('/');
        const marketSell = String(v['零售价'] ?? '').split('/');
        const wholesale = String(v['批发价'] ?? '').split('/');
        const vip = String(v['会员价'] ?? '').split('/');
        const discount = String(v['折扣率一'] ?? '').split('/');
        const discount2 = String(v['折扣率二'] ?? '').split('/');
        const purchase = String(v['预计采购价'] ?? '').split('/');
        const unitIds: number[] = v._unit_ids || [];
        const goodsPrice: any[] = [];
        for (let i = 0; i < units.length; i++) {
          goodsPrice.push({
            goods_code: v['商品编号'],
            goods_name: v['商品名称'],
            unit: unitIds[i] ?? 0,
            market_sell_price: this.num(marketSell[i]),
            wholesale_price: this.num(wholesale[i]),
            vip_price: this.num(vip[i]),
            discount: this.num(discount[i]),
            discount2: this.num(discount2[i]),
            purchase: this.num(purchase[i]),
            is_default: i < 1 ? 1 : 0,
            createtime: now,
            updatetime: now,
          });
        }

        // 期初：遍历「期初数量-仓库」列与「单位成本-仓库」列
        const storesData: any[] = [];
        let inventory = 0;
        let price = 0;
        for (const key of this.suffixKeys(v, '期初数量')) {
          const storeName = key.split('-')[1];
          const qty = this.num(v[key]);
          if (qty === 0) throw new BadRequestException(`请输入${storeName}期初数量`);
          const cost = this.num(v[`单位成本-${storeName}`]);
          if (this.empty(v[`单位成本-${storeName}`])) throw new BadRequestException(`请输入${storeName}单位成本`);
          const money = this.round(qty * cost, 2);
          storesData.push({
            goods_code: v['商品编号'],
            attribute_id: v.attr_arr || null,
            stores_id: storeMap[storeName] ?? 0,
            stock: qty,
            period: qty,
            unit_cost: cost,
            price: money,
            createtime: now,
            updatetime: now,
          });
          inventory += qty;
          price += money;
        }
        const unitCost = inventory > 0 ? this.round(price / inventory, 2) : 0;
        const nowcate = String(v['商品类别'] ?? '').split('/');
        cur = {
          auxiliary: v.auxiliary,
          auxiliary_type: v.auxiliary_type,
          auxiliary_type_c: v.auxiliary_type_c,
          goods_barcode: v['商品/属性条码'] ?? '',
          goods_type: v['商品类型'] === '成品' ? 2 : 1,
          goods_code: v['商品编号'],
          goods_name: v['商品名称'],
          goods_type_id: cateMap[nowcate[nowcate.length - 1]] ?? 0,
          goods_specification_id: v['规格型号'] ?? '',
          manager_warehouse_id: storeMap[v['首选仓库']] ?? 0,
          unit_id: v._unit_main ?? 0,
          note: v['备注'] ?? '',
          attribute_id: v.attr_arr || null,
          purchase: goodsPrice[0]?.purchase ?? 0,
          market_sell_price: goodsPrice[0]?.market_sell_price ?? 0,
          wholesale_price: goodsPrice[0]?.wholesale_price ?? 0,
          vip_price: goodsPrice[0]?.vip_price ?? 0,
          discount: goodsPrice[0]?.discount ?? 0,
          discount2: goodsPrice[0]?.discount2 ?? 0,
          inventory,
          period: inventory,
          unit_cost: unitCost,
          price,
          more_unit: String(v['计量单位']).indexOf('/') >= 0 ? 1 : 2,
          more_unit_id: String(v['计量单位']).indexOf('/') >= 0 ? v._unit_main : 0,
          period_status: storesData.length ? 1 : 0,
          createtime: now,
          updatetime: now,
          goods_price: goodsPrice,
          stores_data: storesData,
          attr_price: [],
        };
        // 属性行价格：取首个单位的价格行，附属性组合
        const base = { ...(goodsPrice[0] || {}) };
        delete base.unit_id;
        delete base.is_default;
        base.attribute_id = cur.attribute_id;
        base.attr_code = v['属性编号'] ?? null;
        cur.attr_price.push(base);
        params.push(cur);
      } else if (cur && !this.empty(v['商品/属性条码'])) {
        // 属性续行：补充属性价格与各仓库期初
        const marketSell = String(v['零售价'] ?? '').split('/');
        cur.attr_price.push({
          goods_code: cur.goods_code,
          goods_name: cur.goods_name,
          unit: cur.attr_price[0]?.unit ?? 0,
          market_sell_price: this.num(marketSell[0]),
          wholesale_price: this.num(String(v['批发价'] ?? '').split('/')[0]),
          vip_price: this.num(String(v['会员价'] ?? '').split('/')[0]),
          discount: this.num(String(v['折扣率一'] ?? '').split('/')[0]),
          discount2: this.num(String(v['折扣率二'] ?? '').split('/')[0]),
          purchase: this.num(String(v['预计采购价'] ?? '').split('/')[0]),
          createtime: now,
          updatetime: now,
          attribute_id: v.attr_arr || null,
          attr_code: v['属性编号'] ?? null,
        });
        for (const key of this.suffixKeys(v, '期初数量')) {
          const storeName = key.split('-')[1];
          const qty = this.num(v[key]);
          const cost = this.num(v[`单位成本-${storeName}`]);
          cur.period_status = 1;
          cur.stores_data.push({
            goods_code: cur.goods_code,
            attribute_id: v.attr_arr || null,
            stores_id: storeMap[storeName] ?? 0,
            stock: qty,
            period: qty,
            unit_cost: cost,
            price: this.round(qty * cost, 2),
            createtime: now,
            updatetime: now,
          });
          cur.inventory += qty;
          cur.price += this.round(qty * cost, 2);
        }
        cur.unit_cost = cur.inventory > 0 ? this.round(cur.price / cur.inventory, 2) : 0;
        cur.period = cur.inventory;
      }
    }

    // 已存在编号：editstatus=1 转为更新（源：清空四张子表后重建）
    const exist = await this.query('SELECT `id`, `goods_code` FROM `kuyou_goods` WHERE `goods_code` IN (?)', [goodsCodes]);
    const existMap: Record<string, number> = {};
    for (const e of exist) existMap[e.goods_code] = e.id;
    const addCodes: string[] = [];
    const update: any[] = [];
    const add: any[] = [];
    for (const p of params) {
      if (editstatus === 1 && existMap[p.goods_code] !== undefined) {
        p.id = existMap[p.goods_code];
        update.push(p);
      } else {
        addCodes.push(p.goods_code);
        add.push(p);
      }
    }

    // 清掉旧的四张子表（价格 / 库存 / 期初 / 属性），再整体重建
    await this.query('DELETE FROM `kuyou_goods_attr` WHERE `goods_code` IN (?)', [goodsCodes]);
    await this.query('DELETE FROM `kuyou_goods_price` WHERE `goods_code` IN (?)', [goodsCodes]);
    await this.query('DELETE FROM `kuyou_goods_stock` WHERE `goods_code` IN (?)', [goodsCodes]);
    await this.query('DELETE FROM `kuyou_goods_period` WHERE `goods_code` IN (?)', [goodsCodes]);
    if (addCodes.length) await this.query('DELETE FROM `kuyou_goods` WHERE `goods_code` IN (?)', [addCodes]);

    for (const p of add) {
      const goodsPrice = p.goods_price;
      const storesData = p.stores_data;
      const attrPrice = p.attr_price;
      delete p.goods_price;
      delete p.stores_data;
      delete p.attr_price;
      const res = await this.query('INSERT INTO `kuyou_goods` SET ?', [p]);
      await this.writeGoodsChildren(res.insertId, goodsPrice, storesData, attrPrice);
    }
    for (const p of update) {
      const goodsPrice = p.goods_price;
      const storesData = p.stores_data;
      const attrPrice = p.attr_price;
      delete p.goods_price;
      delete p.stores_data;
      delete p.attr_price;
      const id = p.id;
      delete p.id;
      delete p.createtime;
      await this.query('UPDATE `kuyou_goods` SET ? WHERE `id` = ?', [p, id]);
      await this.writeGoodsChildren(id, goodsPrice, storesData, attrPrice);
    }
    return { add: add.length, update: update.length };
  }

  /** 写商品四张子表：价格 / 库存 / 期初 / 属性（库存与期初同源） */
  private async writeGoodsChildren(goodsId: number, goodsPrice: any[], storesData: any[], attrPrice: any[]) {
    if (goodsPrice && goodsPrice.length) {
      for (const r of goodsPrice) r.goods_id = goodsId;
      await this.insertAll('kuyou_goods_price', goodsPrice);
    }
    if (storesData && storesData.length) {
      for (const r of storesData) r.goods_id = goodsId;
      await this.insertAll('kuyou_goods_stock', storesData);
      await this.insertAll('kuyou_goods_period', storesData);
    }
    if (attrPrice && attrPrice.length) {
      for (const r of attrPrice) r.goods_id = goodsId;
      await this.insertAll('kuyou_goods_attr', attrPrice);
    }
  }

  /** 计量单位按名称取 ID，不存在则建档（主单位 is_main=1，辅单位 0） */
  private async unitIdByName(name: string, isMain = true): Promise<number> {
    const rows = await this.query('SELECT `id` FROM `kuyou_unit` WHERE `name` = ?', [name]);
    if (rows.length) return rows[0].id;
    const now = this.now();
    const res = await this.query('INSERT INTO `kuyou_unit` (`name`, `is_main`, `createtime`, `updatetime`) VALUES (?, ?, ?, ?)', [
      name,
      isMain ? 1 : 0,
      now,
      now,
    ]);
    return res.insertId;
  }

  /** 商品分类自动建档：支持 A/B/C 多级路径 */
  private async addGoodsCate(cateData: string[], target: string) {
    for (const one of cateData) {
      if (one.indexOf('/') >= 0) {
        const chain = one.split('/');
        if (chain.indexOf(target) >= 0) {
          let pid = 0;
          for (const nm of chain) {
            if (!nm) continue;
            const rows = await this.query('SELECT `id` FROM `kuyou_goods_type` WHERE `supplier_type_name` = ?', [nm]);
            if (rows.length) {
              pid = rows[0].id;
            } else {
              const now = this.now();
              const res = await this.query(
                'INSERT INTO `kuyou_goods_type` (`supplier_type_name`, `pid`, `createtime`, `updatetime`) VALUES (?, ?, ?, ?)',
                [nm, pid, now, now],
              );
              pid = res.insertId;
            }
          }
        }
      } else if (one === target) {
        const rowsexist = await this.query('SELECT `id` FROM `kuyou_goods_type` WHERE `supplier_type_name` = ?', [one]);
        if (!rowsexist.length) {
          const now = this.now();
          await this.query('INSERT INTO `kuyou_goods_type` (`supplier_type_name`, `pid`, `createtime`, `updatetime`) VALUES (?, ?, ?, ?)', [
            one,
            0,
            now,
            now,
          ]);
        }
      }
    }
  }

  /* ==================== 职员 / 仓库 ==================== */

  /** 职员导入（源 StaffMember::import，表头第 1 行、数据第 2 行起） */
  async staffMember(filePath: string, editstatus: number): Promise<ImportResult> {
    const insert = this.parse(filePath, 1, 2);
    const rows = insert.filter((v) => !this.empty(v['职员编号']) && !this.empty(v['职员名称']));
    if (!rows.length) throw new BadRequestException('未查询到数据');
    const now = this.now();
    const params: any[] = [];
    const seen: string[] = [];
    for (const v of rows) {
      const code = String(v['职员编号']);
      if (seen.indexOf(code) >= 0) throw new BadRequestException(`导入失败，职员编号${code}重复`);
      seen.push(code);
      params.push({ men_code: code, name: v['职员名称'], phone: v['手机号码'] ?? '', createtime: now, updatetime: now });
    }
    return this.upsertByCode('kuyou_staff_member', 'men_code', params, seen, editstatus, '职员编号');
  }

  /** 仓库导入（源 Stores::import，表头第 1 行、数据第 2 行起） */
  async stores(filePath: string, editstatus: number): Promise<ImportResult> {
    const insert = this.parse(filePath, 1, 2);
    const rows = insert.filter((v) => !this.empty(v['仓库编号']));
    if (!rows.length) throw new BadRequestException('未查询到数据');
    const now = this.now();
    const params: any[] = [];
    const seen: string[] = [];
    for (const v of rows) {
      const code = String(v['仓库编号']);
      if (seen.indexOf(code) >= 0) throw new BadRequestException(`导入失败，仓库编号${code}重复`);
      seen.push(code);
      params.push({ store_code: code, name: v['仓库名称'] ?? '', createtime: now, updatetime: now });
    }
    return this.upsertByCode('kuyou_stores', 'store_code', params, seen, editstatus, '仓库编号');
  }

  /** 工厂导入（源前端 factory.js 走通用导入，字段：工厂编号 / 工厂名称） */
  async factory(filePath: string, editstatus: number): Promise<ImportResult> {
    const insert = this.parse(filePath, 1, 2);
    const rows = insert.filter((v) => !this.empty(v['工厂编号']));
    if (!rows.length) throw new BadRequestException('未查询到数据');
    const now = this.now();
    const params: any[] = [];
    const seen: string[] = [];
    for (const v of rows) {
      const code = String(v['工厂编号']);
      if (seen.indexOf(code) >= 0) throw new BadRequestException(`导入失败，工厂编号${code}重复`);
      seen.push(code);
      params.push({ factory_code: code, factory_name: v['工厂名称'] ?? '', createtime: now, updatetime: now });
    }
    return this.upsertByCode('kuyou_factory', 'factory_code', params, seen, editstatus, '工厂编号');
  }

  /** 车间导入（源前端 workshop.js 走通用导入，字段：车间编号 / 车间名称 / 所属工厂） */
  async workshop(filePath: string, editstatus: number): Promise<ImportResult> {
    const insert = this.parse(filePath, 1, 2);
    const rows = insert.filter((v) => !this.empty(v['车间编号']));
    if (!rows.length) throw new BadRequestException('未查询到数据');
    const factories: string[] = [];
    for (const v of rows) this.pushUniq(factories, v['所属工厂']);
    const facMap = await this.nameMap('kuyou_factory', 'factory_name', factories, '工厂');
    const now = this.now();
    const params: any[] = [];
    const seen: string[] = [];
    for (const v of rows) {
      const code = String(v['车间编号']);
      if (seen.indexOf(code) >= 0) throw new BadRequestException(`导入失败，车间编号${code}重复`);
      seen.push(code);
      params.push({
        workshop_code: code,
        workshop_name: v['车间名称'] ?? '',
        factory_id: facMap[v['所属工厂']] ?? 0,
        createtime: now,
        updatetime: now,
      });
    }
    return this.upsertByCode('kuyou_workshop', 'workshop_code', params, seen, editstatus, '车间编号');
  }

  /**
   * 按编号列做「新增或更新」的通用落库
   * editstatus=0 时编号已存在直接报错；=1 时已存在转更新。
   */
  private async upsertByCode(
    table: string,
    codeField: string,
    params: any[],
    codes: string[],
    editstatus: number,
    label: string,
  ): Promise<ImportResult> {
    const exist = await this.query(`SELECT \`id\`, \`${codeField}\` FROM \`${table}\` WHERE \`${codeField}\` IN (?)`, [codes]);
    const existMap: Record<string, number> = {};
    for (const e of exist) existMap[e[codeField]] = e.id;
    if (editstatus === 0) {
      for (const c of codes) {
        if (existMap[c] !== undefined) throw new BadRequestException(`导入失败，${label}${c}已存在`);
      }
    }
    const add: any[] = [];
    const update: any[] = [];
    for (const p of params) {
      if (existMap[p[codeField]] !== undefined && editstatus === 1) {
        p.id = existMap[p[codeField]];
        update.push(p);
      } else {
        add.push(p);
      }
    }
    if (add.length) await this.insertAll(table, add);
    for (const p of update) {
      const id = p.id;
      delete p.id;
      delete p.createtime;
      await this.query(`UPDATE \`${table}\` SET ? WHERE \`id\` = ?`, [p, id]);
    }
    return { add: add.length, update: update.length };
  }

  /* ==================== 客户物料编码 ==================== */

  /**
   * 客户物料编码导入（源 CustomerGoodscoding::import）
   * 必填：客户编号 / 商品编号 / 客户物料编码，且三者须在系统中已存在或唯一。
   */
  async customerGoodscoding(filePath: string, editstatus: number): Promise<ImportResult> {
    const insert = this.parse(filePath, 2, 3);
    const rows = insert.filter((v) => !this.empty(v['客户编号']) && !this.empty(v['商品编号']) && !this.empty(v['客户物料编码']));
    if (!rows.length) throw new BadRequestException('未查询到数据');
    const now = this.now();
    const params: any[] = [];
    const goodsCodes: string[] = [];
    const custCodes: string[] = [];
    const seenMater: string[] = [];
    for (const v of rows) {
      this.pushUniq(goodsCodes, v['商品编号']);
      this.pushUniq(custCodes, v['客户编号']);
      if (seenMater.indexOf(String(v['客户物料编码'])) >= 0) {
        throw new BadRequestException(`导入失败，物料编码${v['客户物料编码']}重复`);
      }
      seenMater.push(String(v['客户物料编码']));
      params.push({
        customers_id: v['客户编号'],
        goods_code: v['商品编号'],
        customer_code: v['客户物料编码'],
        createtime: now,
        updatetime: now,
      });
    }
    // 客户编号 → ID
    const custRows = await this.query('SELECT `id`, `customer_code` FROM `kuyou_customers` WHERE `customer_code` IN (?)', [custCodes]);
    const custMap: Record<string, number> = {};
    for (const c of custRows) custMap[c.customer_code] = c.id;
    for (const c of custCodes) {
      if (custMap[c] === undefined) throw new BadRequestException(`导入失败，客户${c}不存在`);
    }
    for (const p of params) p.customers_id = custMap[p.customers_id];
    // 商品 → 单位（多单位取主单位）
    const goods = await this.query(
      'SELECT `id`, `goods_name`, `unit_id`, `more_unit`, `more_unit_id`, `goods_code` FROM `kuyou_goods` WHERE `goods_code` IN (?)',
      [goodsCodes],
    );
    const unitIds: number[] = [];
    const moreIds: number[] = [];
    for (const g of goods) {
      if (Number(g.more_unit) === 2) unitIds.push(g.unit_id);
      else moreIds.push(g.more_unit_id);
    }
    const conv = moreIds.length
      ? await this.query('SELECT `id`, `main_unit` FROM `kuyou_unit_conversion` WHERE `id` IN (?)', [moreIds])
      : [];
    const convMap: Record<number, number> = {};
    for (const c of conv) convMap[c.id] = c.main_unit;
    const unitMap: Record<string, number> = {};
    for (const g of goods) {
      unitMap[g.goods_code] = Number(g.more_unit) === 2 ? g.unit_id : convMap[g.more_unit_id] ?? 0;
    }
    for (const p of params) p.unit_id = unitMap[p.goods_code] ?? 0;

    // 已存在（客户+商品）组合：0=报错 1=更新
    const add: any[] = [];
    const update: any[] = [];
    for (const p of params) {
      const exist = await this.query(
        'SELECT `id` FROM `kuyou_customer_goodscoding` WHERE `customers_id` = ? AND `goods_code` = ?',
        [p.customers_id, p.goods_code],
      );
      if (exist.length) {
        if (editstatus === 0) throw new BadRequestException(`导入失败，物料编码${p.customer_code}已录入`);
        p.id = exist[0].id;
        update.push(p);
      } else {
        add.push(p);
      }
    }
    if (add.length) await this.insertAll('kuyou_customer_goodscoding', add);
    for (const p of update) {
      const id = p.id;
      delete p.id;
      delete p.createtime;
      await this.query('UPDATE `kuyou_customer_goodscoding` SET ? WHERE `id` = ?', [p, id]);
    }
    return { add: add.length, update: update.length };
  }

  /* ==================== 盘点单导入 ==================== */

  /**
   * 盘点单导入（源 Inventory::import，表头第 1 行、数据第 2 行起）
   * 逐行校验仓库 / 商品类别 / 商品 / 属性，生成盘点主单与明细；
   * 主单 result 汇总盘盈盘亏，store_type 表示是否为全盘。
   */
  async inventory(filePath: string): Promise<ImportResult> {
    const insert = this.parse(filePath, 1, 2);
    if (!insert.length) throw new BadRequestException('未查询到数据');
    const required = ['仓库', '商品类别', '商品编号', '商品名称', '属性编号', '属性名称', '规格型号', '单位', '系统库存', '盘点库存', '商品条码'];
    const data: any[] = [];
    const now = this.now();
    let inventory = 0;
    let profit = 0;
    for (const v of insert) {
      for (const k of required) {
        if (!(k in v)) throw new BadRequestException('表格格式错误');
      }
      if (v['系统库存'] === '') throw new BadRequestException(`请输入${v['商品名称']}系统库存`);
      if (v['盘点库存'] === '') throw new BadRequestException(`请输入${v['商品名称']}盘点库存`);
      if (this.empty(v['仓库'])) throw new BadRequestException(`${v['商品名称']}仓库信息错误`);
      const storeRows = await this.query('SELECT `id` FROM `kuyou_stores` WHERE `name` = ?', [v['仓库']]);
      if (!storeRows.length) throw new BadRequestException(`${v['商品名称']}仓库信息错误`);
      const store = storeRows[0].id;
      let goodsType: number | null = null;
      if (!this.empty(v['商品类别'])) {
        const t = await this.query('SELECT `id` FROM `kuyou_goods_type` WHERE `supplier_type_name` = ?', [v['商品类别']]);
        if (!t.length) throw new BadRequestException(`${v['商品名称']}商品类别信息错误`);
        goodsType = t[0].id;
      }
      let goods: number | null = null;
      if (!this.empty(v['商品条码'])) {
        const g = await this.query('SELECT `id` FROM `kuyou_goods` WHERE `goods_barcode` = ?', [v['商品条码']]);
        if (!g.length) throw new BadRequestException(`${v['商品名称']}信息错误`);
        goods = g[0].id;
      }
      if (!this.empty(v['商品编号'])) {
        const g = await this.query('SELECT `id` FROM `kuyou_goods` WHERE `goods_code` = ?', [v['商品编号']]);
        if (!g.length) throw new BadRequestException(`${v['商品名称']}信息错误`);
        goods = g[0].id;
      }
      let goodsAttr: number | null = null;
      if (!this.empty(v['属性编号'])) {
        const a = await this.query('SELECT `id` FROM `kuyou_goods_attr` WHERE `goods_code` = ? AND `attr_code` = ?', [
          v['商品编号'],
          v['属性编号'],
        ]);
        if (!a.length) throw new BadRequestException(`${v['商品名称']}属性信息错误`);
        goodsAttr = a[0].id;
      }
      const stock = this.num(v['系统库存']);
      const invStock = this.num(v['盘点库存']);
      const diff = invStock - stock;
      if (diff > 0) inventory += diff;
      else if (diff < 0) profit += diff;
      data.push({
        goods_type: goodsType,
        goods_id: goods,
        stores_id: store,
        goods_attr: goodsAttr,
        stock,
        invertory_stock: invStock,
        profit: diff,
        createtime: now,
        updatetime: now,
      });
    }
    if (!data.length) throw new BadRequestException('未查询到数据');
    // 全盘判断：明细条数与系统库存汇总条数一致即为全盘
    const list = await this.query(
      'SELECT COUNT(*) AS `total` FROM (SELECT `gs`.`goods_code`, `gs`.`attribute_id`, `gs`.`stores_id` FROM `kuyou_goods_stock` `gs` JOIN `kuyou_goods` `g` ON `g`.`id` = `gs`.`goods_id` WHERE `g`.`serial` <> 1 GROUP BY `gs`.`goods_code`, `gs`.`attribute_id`, `gs`.`stores_id`) `t`',
    );
    const storeType = list[0] && Number(list[0].total) === data.length ? 1 : 2;
    let result = '';
    if (inventory > 0) result += ` 盘盈：${inventory};`;
    if (profit < 0) result += ` 盘亏：${profit};`;
    const code = await this.nextCode('kuyou_inventory', 'PD');
    const res = await this.query(
      'INSERT INTO `kuyou_inventory` (`purchase_code`, `purchase_time`, `store_type`, `result`, `createtime`, `updatetime`) VALUES (?, ?, ?, ?, ?, ?)',
      [code, now, storeType, result, now, now],
    );
    for (const d of data) {
      d.purchase_code = code;
      d.purchase_time = now;
    }
    await this.insertAll('kuyou_inventory_info', data);
    return { add: res.insertId ? 1 : 0, update: 0 };
  }

  /* ==================== 通用导入（按列注释映射） ==================== */

  /**
   * 通用导入：按 Excel 表头的中文注释匹配数据库列（FastAdmin 默认导入行为）
   * 覆盖源前端为每张基础资料表准备的「导入」按钮；已被专用导入接管的实体不在此列。
   *
   * @param table 目标表名（可省略 kuyou_ 前缀）
   * @param filePath 上传文件绝对路径
   * @param editstatus 0=遇重复编号中止 1=重复编号转为更新
   */
  async generic(table: string, filePath: string, editstatus: number): Promise<ImportResult> {
    const t = String(table || '').startsWith('kuyou_') ? table : `kuyou_${table}`;
    const meta = TABLE_META[t];
    if (!meta) throw new BadRequestException('表不存在或未授权');
    const commentMap = TABLE_COMMENTS[t] || {};

    // 表头行自适应：优先第 1 行，命中不到已知列时改用第 2 行
    const rows = this.pickHeadRow(filePath, commentMap, meta.columns);
    if (!rows.length) throw new BadRequestException('未查询到数据');

    const now = this.now();
    const pk = meta.pk;
    const allowed = new Set(meta.columns);
    const params: any[] = [];
    for (const row of rows) {
      const item: Record<string, any> = {};
      for (const key of Object.keys(row)) {
        const col = commentMap[key] || (allowed.has(key) ? key : null);
        if (!col || !allowed.has(col)) continue;
        if (col === pk || col === 'deletetime') continue;
        const val = row[key];
        if (val === '' || val === null || val === undefined) continue;
        item[col] = val;
      }
      if (!Object.keys(item).length) continue;
      item.createtime = now;
      item.updatetime = now;
      params.push(item);
    }
    if (!params.length) throw new BadRequestException('未查询到数据');

    // 重复编号处理：取表中首个唯一性编号列（*_code）作为判重依据
    const codeField = meta.columns.find((c) => /_code$/.test(c) && c !== 'attr_code');
    if (codeField && params.every((p) => p[codeField] !== undefined)) {
      return this.upsertByCode(t, codeField, params, params.map((p) => String(p[codeField])), editstatus, '编号');
    }
    await this.insertAll(t, params);
    return { add: params.length, update: 0 };
  }

  /** 表头行自适应：返回按「注释 → 列名」映射后的数据行数组 */
  private pickHeadRow(filePath: string, commentMap: Record<string, string>, columns: string[]): Record<string, any>[] {
    const allowed = new Set(columns);
    for (const headRow of [1, 2]) {
      const rows = this.parse(filePath, headRow, headRow + 1);
      if (!rows.length) continue;
      // 命中率：表头能映射到已知列的个数
      const heads = Object.keys(rows[0]);
      const hit = heads.filter((h) => commentMap[h] || allowed.has(h)).length;
      if (hit >= Math.max(1, Math.ceil(heads.length / 2))) return rows;
    }
    return [];
  }

  /* ==================== 工具 ==================== */

  /** 判断单元格是否为空（与源 empty() 语义一致：0 与 '' 均视为空） */
  private empty(v: any): boolean {
    return v === undefined || v === null || v === '' || v === '0' || v === 0;
  }

  /** 去重追加 */
  private pushUniq(arr: string[], v: any) {
    if (v === undefined || v === null || v === '') return;
    const s = String(v);
    if (arr.indexOf(s) < 0) arr.push(s);
  }

  /**
   * 名称 → ID 字典，缺失时按 label 报错
   * @param allowMissing 为 true 时不报错，交给上层做自动建档
   */
  private async nameMap(
    table: string,
    nameField: string,
    names: string[],
    label: string,
    allowMissing = false,
  ): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    if (!names.length) return out;
    const rows = await this.query(`SELECT \`id\`, \`${nameField}\` FROM \`${table}\` WHERE \`${nameField}\` IN (?)`, [names]);
    for (const r of rows) out[r[nameField]] = r.id;
    if (!allowMissing) {
      for (const n of names) {
        if (out[n] === undefined) throw new BadRequestException(`${label}${n}不存在`);
      }
    }
    return out;
  }

  /** 编号 → ID 字典，缺失时按 label 报错 */
  private async codeMap(table: string, codeField: string, codes: string[], label: string): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    if (!codes.length) return out;
    const rows = await this.query(`SELECT \`id\`, \`${codeField}\` FROM \`${table}\` WHERE \`${codeField}\` IN (?)`, [codes]);
    for (const r of rows) out[r[codeField]] = r.id;
    for (const c of codes) {
      if (out[c] === undefined) throw new BadRequestException(`编号为${c}的${label}不存在，导入失败`);
    }
    return out;
  }

  /** 批量插入：把对象数组拼成多值 INSERT */
  private async insertAll(table: string, rows: any[]) {
    if (!rows || !rows.length) return;
    const keys = Object.keys(rows[0]);
    const cols = keys.map((k) => `\`${k}\``).join(', ');
    const placeholders = rows.map(() => `(${keys.map(() => '?').join(', ')})`).join(', ');
    const values: any[] = [];
    for (const r of rows) for (const k of keys) values.push(r[k]);
    await this.query(`INSERT INTO \`${table}\` (${cols}) VALUES ${placeholders}`, values);
  }

  /** 生成单据编号：前缀 + 年月日 + 4 位序列 */
  private async nextCode(table: string, prefix: string): Promise<string> {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const day = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
    const rows = await this.query(`SELECT COUNT(*) AS \`total\` FROM \`${table}\``);
    const seq = String((rows[0]?.total || 0) + 1).padStart(4, '0');
    return `${prefix}${day}${seq}`;
  }

  /* ==================== 单据级 Excel 导入 ==================== */

  /**
   * 单据级 Excel 导入（对应源端各单据 import 能力）
   * 模板约定：第 2 行表头、第 3 行起数据；每行同时含「单据头字段 + 明细行字段」，
   * 按 codeHeader（单据编号）分组，每组生成一张待审核单据并调用 saveDoc 落库。
   * @param docType 注册的单据 key（kuyou_goods_purchase / kuyou_goods_sales …）
   * @param file    上传的相对路径（/uploads/xxx.xlsx）
   * @param user    当前登录用户（写入 admin_id / 制单人）
   * @param opts    headRow / dataStart 可覆盖模板默认
   */
  async importDocument(
    docType: string,
    file: string,
    user: any,
    opts: { headRow?: number; dataStart?: number } = {},
  ): Promise<{ docs: number; lines: number; errors: any[] }> {
    if (!this.docSvc) throw new BadRequestException('单据导入服务未注入');
    const tpl = DOC_IMPORT_TEMPLATES[docType];
    if (!tpl) throw new BadRequestException(`暂不支持该单据类型的导入: ${docType}`);
    const abs = path.join(process.cwd(), 'uploads', path.basename(String(file || '')));
    const headRow = opts.headRow || tpl.headRow;
    const dataStart = opts.dataStart || tpl.dataStart;
    const rows = this.parse(abs, headRow, dataStart);
    if (!rows.length) return { docs: 0, lines: 0, errors: [{ msg: '未查询到数据' }] };

    const goodsCache = new Map<string, number>();
    const goodsIdOf = async (code: string): Promise<number> => {
      if (goodsCache.has(code)) return goodsCache.get(code)!;
      const r = await this.conn.query('SELECT `id` FROM `kuyou_goods` WHERE `goods_code` = ? LIMIT 1', [code]);
      const id = Number(r[0]?.id || 0);
      goodsCache.set(code, id);
      return id;
    };

    // 单位名称 → ID（明细表 goods_unit / default_unit 为整型单位 ID；模板用单位名更友好）
    const unitCache = new Map<string, number>();
    const unitIdOf = async (name: string): Promise<number> => {
      if (unitCache.has(name)) return unitCache.get(name)!;
      const r = await this.conn.query('SELECT `id` FROM `kuyou_unit` WHERE `name` = ? LIMIT 1', [name]);
      const id = Number(r[0]?.id || 0);
      unitCache.set(name, id);
      return id;
    };

    interface Group {
      header: Record<string, any>;
      lines: Record<string, any>[];
      init: boolean;
    }
    const groups = new Map<string, Group>();
    let auto = 0;
    const errors: any[] = [];

    for (const row of rows) {
      const code = String(row[tpl.codeHeader] ?? '').trim();
      const key = code || `__auto_${++auto}`;
      if (!groups.has(key)) groups.set(key, { header: {}, lines: [], init: false });
      const g = groups.get(key)!;

      if (!g.init) {
        for (const [h, col] of Object.entries(tpl.headerMap)) {
          const v = row[h];
          if (v === undefined || v === '' || v === null) continue;
          g.header[col] = col.endsWith('_time') ? this.toTs(v) : v;
        }
        g.init = true;
      }

      const line: Record<string, any> = {};
      for (const [h, col] of Object.entries(tpl.lineMap)) {
        const v = row[h];
        if (v === undefined || v === '' || v === null) continue;
        line[col] = col.endsWith('_time') ? this.toTs(v) : v;
      }
      const gc = String(row['商品编码'] ?? '').trim();
      if (gc) {
        const gid = await goodsIdOf(gc);
        if (gid) line['goods_id'] = gid;
        line['goods_code'] = gc;
      }
      // 单位名 → ID（避免整型列收到字符串报错）
      for (const uc of ['goods_unit', 'default_unit']) {
        const v = line[uc];
        if (v !== undefined && v !== null && v !== '' && isNaN(Number(v))) {
          line[uc] = await unitIdOf(String(v).trim());
        }
      }
      if (Object.keys(line).length) g.lines.push(line);
    }

    let docs = 0;
    let lines = 0;
    for (const [code, g] of groups) {
      try {
        if (!g.lines.length) {
          errors.push({ code, msg: '无有效明细行' });
          continue;
        }
        await this.docSvc.saveDoc(docType, { header: g.header, lines: g.lines }, user);
        docs++;
        lines += g.lines.length;
      } catch (e: any) {
        errors.push({ code, msg: e?.message || String(e) });
      }
    }
    return { docs, lines, errors };
  }
}

/** 单据导入模板：表头行 / 数据起始行 / 单据编号列 / 表头字段映射 / 明细字段映射 */
interface DocImportTemplate {
  headRow: number;
  dataStart: number;
  codeHeader: string;
  headerMap: Record<string, string>;
  lineMap: Record<string, string>;
}

const DOC_IMPORT_TEMPLATES: Record<string, DocImportTemplate> = {
  kuyou_goods_purchase: {
    headRow: 2,
    dataStart: 3,
    codeHeader: '单据编号',
    headerMap: {
      单据编号: 'purchase_code',
      供应商编码: 'supplyer_code',
      业务日期: 'purchase_time',
      交货日期: 'delivery_time',
      仓库: 'stores_id',
      备注: 'note',
      优惠率: 'preferential_rate',
      优惠金额: 'preferential_money',
      实际金额: 'real_money',
    },
    lineMap: {
      商品编码: 'goods_code',
      商品名称: 'goods_note',
      单位: 'goods_unit',
      数量: 'number',
      单价: 'unit_price',
      折扣: 'discount',
      金额: 'all_money',
      税率: 'tax_rate',
      备注: 'remark',
    },
  },
  kuyou_goods_sales: {
    headRow: 2,
    dataStart: 3,
    codeHeader: '单据编号',
    headerMap: {
      单据编号: 'purchase_code',
      客户ID: 'customers_id',
      业务员: 'sale_user',
      业务日期: 'purchase_time',
      交货日期: 'delivery_time',
      仓库: 'stores_id',
      备注: 'note',
    },
    lineMap: {
      商品编码: 'goods_code',
      商品名称: 'goods_note',
      单位: 'goods_unit',
      数量: 'number',
      单价: 'unit_price',
      折扣: 'discount',
      金额: 'all_money',
      税率: 'tax_rate',
      备注: 'remark',
    },
  },
};
