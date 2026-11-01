import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ok200 } from '../../../common/utils/resp';
import * as https from 'https';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 订货小程序 order 模块业务实现
 *
 * 路由前缀对齐原 PHP：/kuyou/order/{index|config|address|user|common|weixin}/<action>
 * 数据库表名与 kuyou-1.2.4-extended 完全一致（kuyou_user_cart、kuyou_user_order 等），
 * 因此所有 SQL 直接复用原逻辑。鉴权使用全局 JWT（Authorization: Bearer），
 * 与小程序端 request.js 改造后的请求头一致。
 *
 * 说明：短信(SMS)/邮件(EMS)/微信订阅消息/微信支付 依赖第三方配置，此处做好结构并对
 * 未配置项给出明确错误；微信 code→session、统一下单、回调验签 已按原 PHP 逻辑实现。
 */

@Injectable()
export class OrderService {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  /* ===================== 基础工具 ===================== */

  query(sql: string, params: any[] = []) {
    return this.conn.query(sql, params);
  }

  private num(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private empty(v: any): boolean {
    return v === undefined || v === null || v === '';
  }

  private now(): number {
    return Math.floor(Date.now() / 1000);
  }

  /** 把价格按小数点拆成 整数 + 两位小数（与 PHP 行为一致） */
  private splitDecimal(price: any): { price: string; decimal: string } {
    const p = price === '' || price === null || price === undefined ? '' : String(price);
    if (p === '') return { price: '', decimal: '' };
    const parts = p.split('.');
    if (parts.length === 2) {
      let dec = parts[1];
      if (dec.length > 2) dec = dec.substring(1, 3);
      else if (dec.length === 1) dec = dec + '0';
      else if (dec.length === 0) dec = '00';
      return { price: parts[0], decimal: dec };
    }
    return { price: p, decimal: '00' };
  }

  private async getGoodsImage(): Promise<string> {
    const row = (await this.query("SELECT `value` FROM `kuyou_sets` WHERE `name` = 'noimage'"))[0];
    return row && row.value ? row.value : '/assets/addons/kuyou/img/noimage.png';
  }

  /* ===================== 价格字段 / 单位 / 属性 ===================== */

  /**
   * 根据登录客户等级决定查价字段（对齐 PHP getPriceField）
   */
  async getPriceField(userId: number | null): Promise<{ login: boolean; customerlevel: number; field: string }> {
    let field = 'market_sell_price';
    let login = false;
    let customerlevel = 0;
    if (userId) {
      const user = (await this.query('SELECT `binding`,`customers_id` FROM `kuyou_user` WHERE `id` = ?', [userId]))[0];
      if (user && this.num(user.binding) === 1 && !this.empty(user.customers_id)) {
        const level = (await this.query('SELECT `customerlevel_id` FROM `kuyou_customers` WHERE `id` = ?', [user.customers_id]))[0];
        customerlevel = level ? this.num(level.customerlevel_id) : 0;
        switch (customerlevel) {
          case 2:
            field = 'wholesale_price';
            break;
          case 3:
            field = 'vip_price';
            break;
          default:
            field = 'market_sell_price';
        }
        login = true;
      }
    }
    return { login, customerlevel, field };
  }

  /** 价格小数位配置 */
  private async priceDecimal(): Promise<number> {
    const row = (await this.query("SELECT `value` FROM `kuyou_sets` WHERE `name` = 'price_decimal'"))[0];
    return row ? this.num(row.value) : 0;
  }

  /** 多单位 + 单位价格（对齐 PHP getGoodsUnit） */
  async getGoodsUnit(
    id: number,
    goodsUnit = '',
    goodsAttr = '',
    priceField?: { login: boolean; customerlevel: number; field: string },
  ): Promise<any[]> {
    const pf = priceField || { login: false, customerlevel: 0, field: 'market_sell_price' };
    const decimal = await this.priceDecimal();
    const row = (
      await this.query(
        'SELECT `more_unit`,`unit_id`,`more_unit_id`,`' +
          pf.field +
          '` AS price,`discount`,`discount2`,`auxiliary` FROM `kuyou_goods` WHERE `id` = ?',
        [id],
      )
    )[0];
    if (!row) return [];

    let where: any = { goods_id: id };
    if (goodsAttr) {
      const attrId = (await this.query('SELECT `attribute_id` FROM `kuyou_goods_attr` WHERE `id` = ? AND `goods_id` = ?', [goodsAttr, id]))[0];
      if (attrId && attrId.attribute_id) where.attribute_id = attrId.attribute_id;
    }
    const stock = await this.query('SELECT SUM(`stock`) AS s FROM `kuyou_goods_stock` WHERE `goods_id` = ?', [id]);
    const stockVal = stock[0] && stock[0].s != null ? this.num(stock[0].s) : 0;
    const unitListId: Record<string, number> = {};

    let goodsPrice: any[] = [];
    if (this.num(row.more_unit) !== 1) {
      const unitName = (await this.query('SELECT `name` FROM `kuyou_unit` WHERE `id` = ?', [row.unit_id]))[0];
      let price = row.price;
      let discount = row.discount;
      let discount2 = row.discount2;
      if (this.num(row.auxiliary) === 1) {
        const gAttr = (await this.query(
          'SELECT `' + pf.field + '` AS price,`discount`,`discount2` FROM `kuyou_goods_attr` WHERE `goods_id` = ?' + (goodsAttr ? ' AND `id` = ?' : ''),
          goodsAttr ? [id, goodsAttr] : [id],
        ))[0];
        if (gAttr) {
          price = gAttr.price;
          discount = gAttr.discount;
          discount2 = gAttr.discount2;
        }
      }
      goodsPrice = [
        {
          unit: this.num(row.unit_id),
          price: price === null ? 0 : price,
          discount: discount === null ? 0 : discount,
          discount2: discount2 === null ? 0 : discount2,
          is_default: 1,
          name: unitName ? unitName.name : '',
          stock: stockVal,
        },
      ];
    } else {
      const mainUnit = this.num(row.more_unit_id);
      const unitList = await this.query(
        'SELECT `vice_unit`,`advance_rate` FROM `kuyou_unit_conversion` WHERE `main_unit` = ? ORDER BY `advance_rate` ASC',
        [mainUnit],
      );
      unitList.forEach((u: any) => (unitListId[u.vice_unit] = this.num(u.advance_rate)));
      goodsPrice = await this.query(
        'SELECT g.`unit`,g.`' +
          pf.field +
          '` AS price,g.`discount`,g.`discount2`,g.`is_default`,u.`name` FROM `kuyou_goods_price` g JOIN `kuyou_unit` u ON u.`id`=g.`unit` WHERE g.`goods_id` = ? ORDER BY g.`is_default` DESC',
        [id],
      );
    }

    for (const lp of goodsPrice) {
      if (this.num(lp.is_default) === 1) {
        lp.stock = stockVal;
      } else if (unitListIdSafe(unitListId, lp.unit) && unitListId[lp.unit] != 0) {
        lp.stock = Math.round((stockVal / unitListId[lp.unit]) * 100) / 100;
      } else {
        lp.stock = stockVal;
      }
      if (!pf.login) {
        lp.price = '';
      } else if (pf.customerlevel === 4) {
        lp.price = round2(this.num(lp.price) * this.num(lp.discount) / 100, decimal);
      } else if (pf.customerlevel === 5) {
        lp.price = round2(this.num(lp.price) * this.num(lp.discount2) / 100, decimal);
      }
      delete lp.discount;
      delete lp.discount2;
    }
    return goodsPrice;
  }

  /** 商品辅助属性（对齐 PHP getGoodsAuxiliary） */
  async getGoodsAuxiliary(id: number, priceField?: { login: boolean; customerlevel: number; field: string }): Promise<any[]> {
    const pf = priceField || { login: false, customerlevel: 0, field: 'market_sell_price' };
    const decimal = await this.priceDecimal();
    const auxiliary = await this.query('SELECT `name`,`id` FROM `kuyou_auxiliary` WHERE `status` = 1');
    const auxMap: Record<string, string> = {};
    auxiliary.forEach((a: any) => (auxMap[a.id] = a.name));
    const goodsAttr = await this.query(
      'SELECT `id`,`attribute_id`,`attr_code`,`barcode`,`unit`,`' + pf.field + '` AS price,`discount`,`discount2` FROM `kuyou_goods_attr` WHERE `goods_id` = ?',
      [id],
    );
    for (const ga of goodsAttr) {
      const comb = (await this.query('SELECT `attr_ids` FROM `kuyou_aux_combination` WHERE `id` = ?', [ga.attribute_id]))[0];
      ga.attr_name = '';
      if (comb && comb.attr_ids) {
        const ids = String(comb.attr_ids).split('&');
        ga.attr_name = ids.map((i: string) => auxMap[i] || '').join('/');
      }
      if (!pf.login) {
        ga.price = '';
      } else if (pf.customerlevel === 4) {
        ga.price = round2(this.num(ga.price) * this.num(ga.discount) / 100, decimal);
      } else if (pf.customerlevel === 5) {
        ga.price = round2(this.num(ga.price) * this.num(ga.discount2) / 100, decimal);
      }
      delete ga.discount;
      delete ga.discount2;
      delete ga.attribute_id;
    }
    return goodsAttr;
  }

  /** 地区名（对齐 PHP getArea，返回 {status,msg}） */
  async getArea(id: any): Promise<{ status: number; msg: string }> {
    if (this.empty(id)) return { status: 500, msg: '' };
    const row = (await this.query('SELECT `name` FROM `kuyou_area` WHERE `id` = ?', [this.num(id)]))[0];
    return row ? { status: 200, msg: row.name } : { status: 500, msg: '' };
  }

  /** 生成订单号（对齐 PHP getOrderNum） */
  async getOrderNum(prefix = 'DH'): Promise<string> {
    const orderNum = prefix + dateYmdHis() + Math.floor(Math.random() * 899999 + 100000);
    const exists = (await this.query('SELECT `id` FROM `kuyou_user_order` WHERE `order_num` = ?', [orderNum]))[0];
    if (exists) return this.getOrderNum(prefix);
    return orderNum;
  }

  /* ===================== 鉴权 / 用户 ===================== */

  /** 读取当前小程序用户（来自 JWT） */
  async loadUser(userId: number): Promise<any> {
    const user = (await this.query('SELECT * FROM `kuyou_user` WHERE `id` = ?', [userId]))[0];
    if (!user) throw new BadRequestException('请先登陆');
    if (user.status !== 'normal') throw new BadRequestException('账户已禁用');
    return user;
  }

  private async signToken(userId: number, username: string): Promise<string> {
    return this.jwt.sign({ sub: userId, username }, { expiresIn: 7200 });
  }

  /** 密码加密（对齐 PHP md5(md5(pwd)+salt)） */
  private encryptPassword(password: string, salt: string): string {
    return crypto.createHash('md5').update(crypto.createHash('md5').update(password).digest('hex') + salt).digest('hex');
  }

  /** 账号密码登录（对齐 PHP User::login） */
  async login(account: string, password: string) {
    if (!account || !password) throw new BadRequestException('请输入账户和密码');
    const field = /^\d{11}$/.test(account) ? 'mobile' : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account) ? 'email' : 'username';
    const user = (await this.query('SELECT * FROM `kuyou_user` WHERE `' + field + '` = ?', [account]))[0];
    if (!user) throw new BadRequestException('账户不正确');
    if (user.status !== 'normal') throw new BadRequestException('账户已禁用');
    if (user.password !== this.encryptPassword(password, user.salt)) throw new BadRequestException('密码错误');
    await this.query('UPDATE `kuyou_user` SET `logintime` = ?, `loginip` = ? WHERE `id` = ?', [this.now(), '', user.id]);
    const token = await this.signToken(user.id, user.username);
    const userinfo = this.userInfoShape(user);
    userinfo.token = token;
    return { token, userinfo };
  }

  /** 手机验证码登录（对齐 PHP mobilelogin，SMS 校验在 controller 层处理） */
  async mobilelogin(mobile: string, userId: number | null) {
    let user = userId ? (await this.query('SELECT * FROM `kuyou_user` WHERE `id` = ?', [userId]))[0] : null;
    if (!user) user = (await this.query('SELECT * FROM `kuyou_user` WHERE `mobile` = ?', [mobile]))[0];
    if (!user) {
      const salt = randomStr(8);
      const pwd = this.encryptPassword(randomStr(8), salt);
      const res = await this.query(
        'INSERT INTO `kuyou_user` (`username`,`password`,`salt`,`nickname`,`mobile`,`status`,`jointime`,`logintime`) VALUES (?,?,?,?,?,?,?,?)',
        [mobile, pwd, salt, mobile, mobile, 'normal', this.now(), this.now()],
      );
      const id = (res as any).insertId;
      user = (await this.query('SELECT * FROM `kuyou_user` WHERE `id` = ?', [id]))[0];
    } else if (user.status !== 'normal') {
      throw new BadRequestException('账户已禁用');
    }
    const token = await this.signToken(user.id, user.username);
    const userinfo = this.userInfoShape(user);
    userinfo.token = token;
    return { token, userinfo };
  }

  /** 注册（对齐 PHP register） */
  async register(username: string, password: string, email: string, mobile: string) {
    if (!username || !password) throw new BadRequestException('参数错误');
    const exists = (await this.query('SELECT `id` FROM `kuyou_user` WHERE `username` = ? OR `mobile` = ? OR `email` = ?', [username, mobile, email]))[0];
    if (exists) throw new BadRequestException('账户已存在');
    const salt = randomStr(8);
    const pwd = this.encryptPassword(password, salt);
    const res = await this.query(
      'INSERT INTO `kuyou_user` (`username`,`password`,`salt`,`nickname`,`email`,`mobile`,`status`,`jointime`,`logintime`) VALUES (?,?,?,?,?,?,?,?,?)',
      [username, pwd, salt, username, email || '', mobile || '', 'normal', this.now(), this.now()],
    );
    const id = (res as any).insertId;
    const user = (await this.query('SELECT * FROM `kuyou_user` WHERE `id` = ?', [id]))[0];
    const token = await this.signToken(user.id, user.username);
    const userinfo = this.userInfoShape(user);
    userinfo.token = token;
    return { token, userinfo };
  }

  /** 用户信息（对齐 PHP userInfo） */
  async userInfo(userId: number) {
    const user = await this.loadUser(userId);
    return { userinfo: this.userInfoShape(user) };
  }

  /** 个人资料（对齐 PHP profile） */
  async profile(userId: number, nickname?: string, avatar?: string) {
    const cols: string[] = [];
    const params: any[] = [];
    if (!this.empty(nickname)) {
      cols.push('`nickname` = ?');
      params.push(nickname);
    }
    if (!this.empty(avatar)) {
      cols.push('`avatar` = ?');
      params.push(avatar);
    }
    if (!cols.length) throw new BadRequestException('无更新内容');
    params.push(userId);
    await this.query('UPDATE `kuyou_user` SET ' + cols.join(', ') + ' WHERE `id` = ?', params);
    return true;
  }

  /** 修改手机号（对齐 PHP changemobile：绑定客户） */
  async changemobile(userId: number, mobile: string) {
    if (!/^\d{11}$/.test(mobile)) throw new BadRequestException('手机号格式错误');
    const same = (await this.query('SELECT `id` FROM `kuyou_user` WHERE `mobile` = ? AND `id` <> ?', [mobile, userId]))[0];
    if (same) throw new BadRequestException('手机号已绑定');
    const customer = (await this.query('SELECT `id` FROM `kuyou_customers` WHERE `customer_mobile` = ?', [mobile]))[0];
    if (!customer) throw new BadRequestException('此手机号尚未成为客户，不可绑定');
    await this.query(
      'UPDATE `kuyou_user` SET `binding`=1,`customers_id`=?,`username`=?,`mobile`=? WHERE `id` = ?',
      [customer.id, mobile, mobile, userId],
    );
    return true;
  }

  /** 重置密码（对齐 PHP resetpwd） */
  async resetpwd(userId: number, newpassword: string) {
    const salt = randomStr(8);
    const pwd = this.encryptPassword(newpassword, salt);
    await this.query('UPDATE `kuyou_user` SET `password`=?,`salt`=? WHERE `id` = ?', [pwd, salt, userId]);
    return true;
  }

  /** 对外输出用户字段（对齐 PHP allowFields + Token） */
  userInfoShape(user: any): Record<string, any> {
    const expiretime = this.now() + 7200;
    return {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      mobile: user.mobile,
      avatar: user.avatar ? user.avatar : '',
      score: user.score,
      binding: this.num(user.binding),
      customers_id: user.customers_id || 0,
      expiretime,
      token: '',
    };
  }

  /* ===================== 购物车 ===================== */

  async getCart(userId: number) {
    const cart = await this.query('SELECT * FROM `kuyou_user_cart` WHERE `user_id` = ?', [userId]);
    if (!cart.length) throw new BadRequestException('购物车空空如也');
    const noImage = await this.getGoodsImage();
    const pf = await this.getPriceField(userId);
    for (const c of cart) {
      const row = (
        await this.query(
          'SELECT `id`,`goods_code`,`goods_name`,`goods_barcode`,`goods_specification_id` AS goods_spec,`goods_type_id`,`unit_id`,`goods_image`,`goods_images`,`note`,`more_unit` FROM `kuyou_goods` WHERE `id` = ? AND `status` = 1',
          [c.goods_id],
        )
      )[0];
      if (row) {
        if (this.empty(row.goods_image)) row.goods_image = noImage;
        if (!this.empty(row.goods_images)) row.goods_images = String(row.goods_images).split(',');
        const unitData = await this.getGoodsUnit(row.id, c.goods_unit, c.goods_attr, pf);
        row.price = '';
        row.unit_name = '';
        for (const u of unitData) {
          if (this.num(u.unit) === this.num(c.goods_unit)) {
            row.price = u.price;
            row.unit_name = u.name;
          }
        }
        row.attr_name = '';
        const attrData = await this.getGoodsAuxiliary(row.id, pf);
        for (const a of attrData) {
          if (this.num(a.id) === this.num(c.goods_attr)) row.attr_name = a.attr_name;
        }
      } else {
        row.goods_images = [];
        row.unit_data = [];
        row.attr_data = [];
      }
      const d = this.splitDecimal(row.price);
      c.goods = { ...row, price: d.price, decimal: d.decimal };
    }
    return cart;
  }

  async getCartNumber(userId: number) {
    const row = (await this.query('SELECT SUM(`number`) AS n FROM `kuyou_user_cart` WHERE `user_id` = ?', [userId]))[0];
    return this.num(row.n);
  }

  async addCart(userId: number, goodsId: number, goodsUnit: number, number: number, goodsAttr = 0) {
    if (!goodsId || !goodsUnit || !number) throw new BadRequestException('参数错误');
    const goods = (await this.query('SELECT `id` FROM `kuyou_goods` WHERE `id` = ? AND `status` = 1', [goodsId]))[0];
    if (!goods) throw new BadRequestException('未查询到商品数据');
    const exists = (await this.query(
      'SELECT * FROM `kuyou_user_cart` WHERE `user_id` = ? AND `goods_id` = ? AND `goods_unit` = ? AND `goods_attr` = ?',
      [userId, goodsId, goodsUnit, goodsAttr],
    ))[0];
    if (exists) {
      await this.query('UPDATE `kuyou_user_cart` SET `number` = `number` + ? WHERE `id` = ?', [number, exists.id]);
    } else {
      if (number <= 0) throw new BadRequestException('数量不能等于0');
      await this.query(
        'INSERT INTO `kuyou_user_cart` (`user_id`,`goods_id`,`goods_unit`,`goods_attr`,`number`) VALUES (?,?,?,?,?)',
        [userId, goodsId, goodsUnit, goodsAttr, number],
      );
    }
    return true;
  }

  async editCart(userId: number, cartId: number, goodsId: number, number: number) {
    if (!number) throw new BadRequestException('参数错误');
    let cart: any = null;
    if (cartId > 0) {
      cart = (await this.query('SELECT * FROM `kuyou_user_cart` WHERE `user_id` = ? AND `id` = ?', [userId, cartId]))[0];
    } else if (goodsId > 0) {
      cart = (await this.query('SELECT * FROM `kuyou_user_cart` WHERE `user_id` = ? AND `goods_id` = ?', [userId, goodsId]))[0];
    } else {
      throw new BadRequestException('参数错误');
    }
    if (!cart) throw new BadRequestException('未找到相关信息');
    if (number <= 0) throw new BadRequestException('数量不能等于0');
    await this.query('UPDATE `kuyou_user_cart` SET `number` = ? WHERE `id` = ?', [number, cart.id]);
    return true;
  }

  async delCart(userId: number, cartIds: string) {
    const ids = String(cartIds).split(',').map((s) => this.num(s.trim())).filter((n) => n > 0);
    if (!ids.length) throw new BadRequestException('参数错误');
    await this.query('DELETE FROM `kuyou_user_cart` WHERE `user_id` = ? AND `id` IN (?)', [userId, ids]);
    return true;
  }

  /* ===================== 商品 ===================== */

  async goodsTypeList(pid: any, userId: number | null) {
    const wherePid = this.empty(pid) ? 0 : this.num(pid);
    const list = await this.query(
      "SELECT `id`,`pid`,`supplier_type_name` AS name,`supplier_type_image` AS image,`status`,FROM_UNIXTIME(`createtime`,'%Y-%m-%d') AS createtime FROM `kuyou_goods_type` WHERE `pid` = ? AND `status` = 1 AND `order_status` = 1",
      [wherePid],
    );
    for (const t of list) {
      const childIds = await this.query('SELECT `id` FROM `kuyou_goods_type` WHERE `path` LIKE ?', ['%,' + t.id + ',%']);
      const ids = childIds.map((c: any) => this.num(c.id));
      ids.push(t.id);
      const goodsIds = ids.length
        ? await this.query('SELECT `id` FROM `kuyou_goods` WHERE `goods_type_id` IN (?)', [ids])
        : [];
      const gIds = goodsIds.map((g: any) => this.num(g.id));
      const cartGoods = gIds.length
        ? await this.query('SELECT `goods_id` FROM `kuyou_user_cart` WHERE `user_id` = ? AND `goods_id` IN (?)', [userId, gIds])
        : [];
      t.goods_id = cartGoods.map((c: any) => this.num(c.goods_id));
      t.cart_number = gIds.length
        ? await this.query('SELECT SUM(`number`) AS n FROM `kuyou_user_cart` WHERE `user_id` = ? AND `goods_id` IN (?)', [userId, gIds]).then((r: any) => this.num(r[0].n))
        : 0;
    }
    return list;
  }

  async goodsGoodsList(data: any, userId: number | null) {
    const page = data.page ? this.num(data.page) : 1;
    const limit = data.limit ? this.num(data.limit) : 10;
    const where: string[] = ['g.`status` = 1', 'g.`order_status` = 1'];
    const params: any[] = [];
    const pf = await this.getPriceField(userId);
    const field = pf.field;
    if (!this.empty(data.keyword)) {
      where.push('(g.`goods_code` LIKE ? OR g.`goods_name` LIKE ? OR g.`goods_barcode` LIKE ?)');
      params.push('%' + data.keyword + '%', '%' + data.keyword + '%', '%' + data.keyword + '%');
    }
    if (!this.empty(data.goods_type_id)) {
      const childIds = await this.query('SELECT `id` FROM `kuyou_goods_type` WHERE `path` LIKE ?', ['%,' + data.goods_type_id + ',%']);
      const ids = childIds.map((c: any) => this.num(c.id));
      ids.push(this.num(data.goods_type_id));
      where.push('g.`goods_type_id` IN (?)');
      params.push(ids);
    }
    if (!this.empty(data.tag)) {
      where.push('g.`tag` LIKE ?');
      params.push('%' + data.tag + '%');
    }
    if (!this.empty(data.promotion)) {
      where.push('g.`promotion` = 1');
    }
    const decimal = await this.priceDecimal();
    const noImage = await this.getGoodsImage();
    const sql =
      'SELECT g.`id`,g.`goods_code`,g.`goods_type_id`,g.`goods_name`,g.`goods_barcode`,g.`note`,g.`goods_specification_id` AS goods_spec,g.`unit_id`,u.`name` AS unit_name,g.`more_unit`,g.`' +
      field +
      '` AS price,g.`discount`,g.`discount2`,g.`goods_image`,g.`inventory` AS stock,g.`status`,FROM_UNIXTIME(g.`updatetime`,\'%Y-%m-%d %H:%i:%s\') AS updatetime ' +
      'FROM `kuyou_goods` g JOIN `kuyou_unit` u ON u.`id`=g.`unit_id` WHERE ' +
      where.join(' AND ');
    const list = await this.query(sql + ' ORDER BY g.`promotion` DESC, g.`sale_number` DESC, g.`id` DESC LIMIT ? OFFSET ?', [...params, limit, (page - 1) * limit]);
    for (const g of list) {
      if (this.empty(g.price)) {
        const ud = await this.getGoodsUnit(g.id, g.unit_id, '', pf);
        g.price = ud.length ? ud[0].price : 0;
      }
      if (this.empty(g.goods_image)) g.goods_image = noImage;
      if (!pf.login) {
        g.price = '';
      } else if (pf.customerlevel === 4) {
        g.price = round2(this.num(g.price) * this.num(g.discount) / 100, decimal);
      } else if (pf.customerlevel === 5) {
        g.price = round2(this.num(g.price) * this.num(g.discount2) / 100, decimal);
      }
      delete g.discount;
      delete g.discount2;
      if (this.num(g.more_unit) === 1) {
        const mores = await this.query(
          'SELECT uc.`vice_unit`,u.`name` FROM `kuyou_unit_conversion` uc JOIN `kuyou_unit` u ON u.`id`=uc.`vice_unit` WHERE uc.`main_unit` = ? ORDER BY uc.`advance_rate` ASC',
          [g.unit_id],
        );
        let uname = g.unit_name;
        let rate = '1';
        for (const m of mores) {
          uname += ',' + m.name;
          rate += ':' + m.vice_unit;
        }
        g.unit_name = uname + '(' + rate + ')';
      }
      if (!this.empty(g.goods_type_id)) {
        const path = (await this.query('SELECT `path` FROM `kuyou_goods_type` WHERE `id` = ?', [g.goods_type_id]))[0];
        if (path && path.path) {
          const parent = (await this.query('SELECT `id` FROM `kuyou_goods_type` WHERE `id` IN (?) AND `pid` = 0', [String(path.path).split(',')]))[0];
          g.parent_goods_type_id = parent ? this.num(parent.id) : 0;
        } else g.parent_goods_type_id = 0;
      } else g.parent_goods_type_id = 0;
      const cart = (await this.query('SELECT `id` FROM `kuyou_user_cart` WHERE `user_id` = ? AND `goods_id` = ?', [userId, g.id]))[0];
      g.cart_status = cart ? 1 : 0;
      g.cart_number = this.num((await this.query('SELECT SUM(`number`) AS n FROM `kuyou_user_cart` WHERE `user_id` = ? AND `goods_id` = ?', [userId, g.id]))[0].n);
      const d = this.splitDecimal(g.price);
      g.price = d.price;
      g.decimal = d.decimal;
    }
    const countRow = await this.query('SELECT COUNT(*) AS c FROM `kuyou_goods` g WHERE ' + where.join(' AND '), params);
    return { list, count: this.num(countRow[0].c) };
  }

  async goodsGoodsInfo(id: number, userId: number | null, goodsUnit = '', goodsAttr = '') {
    const row = (
      await this.query(
        'SELECT `id`,`goods_code`,`goods_name`,`goods_barcode`,`goods_specification_id` AS goods_spec,`goods_type_id`,`unit_id`,`goods_image`,`goods_images`,`note`,`more_unit`,`content` FROM `kuyou_goods` WHERE `id` = ? AND `status` = 1',
        [id],
      )
    )[0];
    if (!row) throw new BadRequestException('未查询到商品数据');
    const noImage = await this.getGoodsImage();
    if (this.empty(row.goods_image)) row.goods_image = noImage;
    if (!this.empty(row.goods_images)) row.goods_images = String(row.goods_images).split(',');
    const pf = await this.getPriceField(userId);
    if (!this.empty(row.goods_type_id)) {
      const path = (await this.query('SELECT `path` FROM `kuyou_goods_type` WHERE `id` = ?', [row.goods_type_id]))[0];
      if (path && path.path) {
        const parent = (await this.query('SELECT `id` FROM `kuyou_goods_type` WHERE `id` IN (?) AND `pid` = 0', [String(path.path).split(',')]))[0];
        row.parent_goods_type_id = parent ? this.num(parent.id) : 0;
      } else row.parent_goods_type_id = 0;
    } else row.parent_goods_type_id = 0;
    row.unit_data = await this.getGoodsUnit(row.id, goodsUnit, goodsAttr, pf);
    row.attr_data = await this.getGoodsAuxiliary(row.id, pf);
    const cartNumber = (await this.query('SELECT SUM(`number`) AS n FROM `kuyou_user_cart` WHERE `user_id` = ? AND `goods_id` = ?', [userId, id]))[0];
    row.cart_number = this.num(cartNumber.n);
    return row;
  }

  async banner(typeId: number) {
    if (!typeId) throw new BadRequestException('参数错误');
    const list = await this.query(
      "SELECT `id`,`name`,`image`,`link`,`status`,FROM_UNIXTIME(`createtime`,'%Y-%m-%d') AS createtime FROM `kuyou_banner` WHERE `type_id` = ? AND `status` = 1",
      [typeId],
    );
    if (!list.length) throw new BadRequestException('查询失败');
    return list;
  }

  async getHistory(userId: number, page: number, limit: number) {
    page = page ? this.num(page) : 1;
    limit = limit ? this.num(limit) : 10;
    const list = await this.query(
      'SELECT * FROM `kuyou_user_history` WHERE `user_id` = ? ORDER BY `id` DESC LIMIT ? OFFSET ?',
      [userId, limit, (page - 1) * limit],
    );
    const count = (await this.query('SELECT COUNT(*) AS c FROM `kuyou_user_history` WHERE `user_id` = ?', [userId]))[0];
    return { list, count: this.num(count.c) };
  }

  /* ===================== 地址 ===================== */

  async addressList(userId: number, page: number, limit: number) {
    page = page ? this.num(page) : 1;
    limit = limit ? this.num(limit) : 10;
    const list = await this.query(
      'SELECT `id`,`nickname`,`connect_name`,`connect_phone`,`connect_mobile`,`province`,`city`,`area`,`detail_address`,`post_code`,`is_default`,FROM_UNIXTIME(`createtime`,\'%Y-%m-%d %H:%i:%s\') AS createtime FROM `kuyou_address` WHERE `user_id` = ? ORDER BY `is_default` DESC, `id` DESC LIMIT ? OFFSET ?',
      [userId, limit, (page - 1) * limit],
    );
    for (const a of list) {
      a.province_name = (await this.getArea(a.province)).msg;
      a.city_name = (await this.getArea(a.city)).msg;
      a.area_name = (await this.getArea(a.area)).msg;
    }
    const count = (await this.query('SELECT COUNT(*) AS c FROM `kuyou_address` WHERE `user_id` = ?', [userId]))[0];
    return { list, count: this.num(count.c) };
  }

  async addressDetail(id: number, userId: number) {
    const row = (await this.query('SELECT * FROM `kuyou_address` WHERE `id` = ? AND `user_id` = ?', [id, userId]))[0];
    if (!row) throw new BadRequestException('未找到收货地址');
    return row;
  }

  async addressSave(data: any, userId: number, id?: number) {
    const allowed = [
      'nickname',
      'connect_name',
      'connect_phone',
      'connect_mobile',
      'province',
      'city',
      'area',
      'detail_address',
      'post_code',
      'is_default',
    ];
    const cols: string[] = [];
    const vals: any[] = [];
    data.user_id = userId;
    for (const k of allowed) {
      if (data[k] !== undefined) {
        cols.push('`' + k + '` = ?');
        vals.push(data[k]);
      }
    }
    if (id) {
      if (!cols.length) return id;
      vals.push(id, userId);
      await this.query('UPDATE `kuyou_address` SET ' + cols.join(', ') + ' WHERE `id` = ? AND `user_id` = ?', vals);
      return id;
    }
    const insertCols = ['user_id', ...allowed.filter((k) => data[k] !== undefined)];
    await this.query(
      'INSERT INTO `kuyou_address` (`' + insertCols.join('`,`') + '`) VALUES (' + insertCols.map(() => '?').join(',') + ')',
      insertCols.map((k) => data[k]),
    );
    const res = (await this.query('SELECT LAST_INSERT_ID() AS id'))[0];
    return this.num(res.id);
  }

  async addressDelete(id: number, userId: number) {
    await this.query('DELETE FROM `kuyou_address` WHERE `id` = ? AND `user_id` = ?', [id, userId]);
    return true;
  }

  /* ===================== 配置 ===================== */

  async configGetdetail(name: string) {
    const row = (await this.query('SELECT `value` FROM `kuyou_user_config` WHERE `name` = ?', [name]))[0];
    if (!row) {
      const row2 = (await this.query('SELECT `value` FROM `kuyou_user_sets` WHERE `name` = ?', [name]))[0];
      if (!row2) throw new BadRequestException('查询失败');
      return { value: row2.value, code: 1 };
    }
    return { value: row.value, code: 1 };
  }

  async configGetSet(name: string) {
    let row = (await this.query('SELECT `value` FROM `kuyou_user_config` WHERE `name` = ?', [name]))[0];
    if (!row) row = (await this.query('SELECT `value` FROM `kuyou_user_sets` WHERE `name` = ?', [name]))[0];
    if (!row) throw new BadRequestException('查询失败');
    return { value: row.value, code: 1 };
  }

  async configGetConfig(names: string[]) {
    const rows = await this.query('SELECT `value`,`name` FROM `kuyou_user_sets` WHERE `name` IN (?)', [names]);
    const map: Record<string, any> = {};
    rows.forEach((r: any) => (map[r.name] = r.value));
    return map;
  }

  /* ===================== 订单 ===================== */

  async createOrder(userId: number, cartIds: string, addressId: any, diverType = 1, storeId = 0) {
    diverType = this.num(diverType) === 2 ? 2 : 1;
    const ids = String(cartIds).split(',').map((s) => this.num(s.trim())).filter((n) => n > 0);
    if (!ids.length) throw new BadRequestException('参数错误');
    const cart = await this.query('SELECT * FROM `kuyou_user_cart` WHERE `user_id` = ? AND `id` IN (?)', [userId, ids]);
    if (!cart.length) throw new BadRequestException('未找到相关信息');
    let address: any = null;
    if (diverType !== 2) {
      if (this.empty(addressId)) {
        address = (await this.query('SELECT * FROM `kuyou_address` WHERE `user_id` = ? AND `is_default` = 1', [userId]))[0];
        if (!address) throw new BadRequestException('未设置默认收货地址，订货单创建失败');
      } else {
        address = (await this.query('SELECT * FROM `kuyou_address` WHERE `user_id` = ? AND `id` = ?', [userId, this.num(addressId)]))[0];
        if (!address) throw new BadRequestException('未找到收货地址，订货单创建失败');
      }
    } else {
      if (this.empty(storeId)) throw new BadRequestException('请选择自提门店');
      const store = (await this.query('SELECT * FROM `kuyou_address` WHERE `id` = ?', [this.num(storeId)]))[0];
      if (!store) throw new BadRequestException('选择的自提门店不可用');
      address = store;
    }
    const noImage = await this.getGoodsImage();
    const pf = await this.getPriceField(userId);
    let orderPrice = 0;
    const info: any[] = [];
    for (const c of cart) {
      const goods = (await this.query('SELECT `id`,`unit_id`,`goods_name`,`goods_image` FROM `kuyou_goods` WHERE `id` = ? AND `status` = 1', [c.goods_id]))[0];
      if (!goods) continue;
      const unitData = await this.getGoodsUnit(goods.id, c.goods_unit, c.goods_attr, pf);
      let price = '';
      let unitName = '';
      for (const u of unitData) {
        if (this.num(u.unit) === this.num(c.goods_unit)) {
          price = String(u.price);
          unitName = u.name;
        }
      }
      const attrData = await this.getGoodsAuxiliary(goods.id, pf);
      let attrName = '';
      for (const a of attrData) {
        if (this.num(a.id) === this.num(c.goods_attr)) attrName = a.attr_name;
      }
      if (!this.empty(price)) {
        orderPrice += this.num(price) * this.num(c.number);
        info.push({
          user_id: userId,
          goods_id: c.goods_id,
          goods_unit: c.goods_unit,
          goods_attr: c.goods_attr,
          goods_name: goods.goods_name,
          goods_image: this.empty(goods.goods_image) ? noImage : goods.goods_image,
          unit_name: unitName,
          attr_name: attrName,
          number: c.number,
          price: price === '' ? 0 : this.num(price),
          money: this.num(price) * this.num(c.number),
          createtime: this.now(),
          updatetime: this.now(),
        });
      }
    }
    if (!info.length || orderPrice <= 0) throw new BadRequestException('数据异常，订货单创建失败');
    const orderNum = await this.getOrderNum('DH');
    const order = {
      user_id: userId,
      name: address ? address.connect_name || '' : '',
      phone: address ? address.connect_mobile || '' : '',
      address: address ? address.detail_address || '' : '',
      order_num: orderNum,
      order_price: orderPrice,
      diver_type: diverType,
      store_id: this.num(storeId),
      createtime: this.now(),
      updatetime: this.now(),
    };
    const orderRes = await this.query(
      'INSERT INTO `kuyou_user_order` (`user_id`,`name`,`phone`,`address`,`order_num`,`order_price`,`diver_type`,`store_id`,`createtime`,`updatetime`) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [order.user_id, order.name, order.phone, order.address, order.order_num, order.order_price, order.diver_type, order.store_id, order.createtime, order.updatetime],
    );
    const orderId = (orderRes as any).insertId;
    info.forEach((i) => (i.order_id = orderId));
    await this.query('INSERT INTO `kuyou_user_orderinfo` (`order_id`,`user_id`,`goods_id`,`goods_unit`,`goods_attr`,`goods_name`,`goods_image`,`unit_name`,`attr_name`,`number`,`price`,`money`,`createtime`,`updatetime`) VALUES ?', [info.map((i) => [i.order_id, i.user_id, i.goods_id, i.goods_unit, i.goods_attr, i.goods_name, i.goods_image, i.unit_name, i.attr_name, i.number, i.price, i.money, i.createtime, i.updatetime])]);
    await this.query('DELETE FROM `kuyou_user_cart` WHERE `user_id` = ? AND `id` IN (?)', [userId, ids]);
    return orderNum;
  }

  private splitGoods(g: any) {
    const dp = this.splitDecimal(g.price);
    g.price = dp.price;
    g.decimal = dp.decimal;
    const dm = this.splitDecimal(g.money);
    g.money = dm.price;
    g.money_decimal = dm.decimal;
    return g;
  }

  /** 仅做订单级小数拆分（商品已在逐单组装时拆分） */
  private decorateOrders(rows: any[]) {
    return rows.map((v) => {
      const d = this.splitDecimal(v.order_price);
      v.order_price = d.price;
      v.decimal = d.decimal;
      return v;
    });
  }

  async getOrderList(userId: number, status?: any, page = 1, limit = 10) {
    const hasStatus = !this.empty(status) && status !== '';
    const list = await this.query(
      'SELECT * FROM `kuyou_user_order` WHERE `user_id` = ?' + (hasStatus ? ' AND `status` = ?' : '') + ' ORDER BY `id` DESC LIMIT ? OFFSET ?',
      hasStatus
        ? [userId, this.num(status), this.num(limit), (this.num(page) - 1) * this.num(limit)]
        : [userId, this.num(limit), (this.num(page) - 1) * this.num(limit)],
    );
    const countRow = (await this.query(
      'SELECT COUNT(*) AS c FROM `kuyou_user_order` WHERE `user_id` = ?' + (hasStatus ? ' AND `status` = ?' : ''),
      hasStatus ? [userId, this.num(status)] : [userId],
    ))[0];
    for (const o of list) {
      const goods = await this.query('SELECT * FROM `kuyou_user_orderinfo` WHERE `order_id` = ?', [o.id]);
      o.goods_list = goods.map((g: any) => this.splitGoods({ ...g }));
    }
    return { list: this.decorateOrders(list), count: this.num(countRow.c) };
  }

  async orderInfo(userId: number, orderNum: string) {
    if (!orderNum) throw new BadRequestException('参数错误');
    const order = (await this.query('SELECT * FROM `kuyou_user_order` WHERE `user_id` = ? AND `order_num` = ?', [userId, orderNum]))[0];
    if (!order) throw new BadRequestException('未找到相关信息');
    const goods = await this.query('SELECT * FROM `kuyou_user_orderinfo` WHERE `order_id` = ?', [order.id]);
    order.goods_list = goods.map((g: any) => this.splitGoods({ ...g }));
    return this.decorateOrders([order])[0];
  }

  async receiving(userId: number, orderNum: string) {
    if (!orderNum) throw new BadRequestException('参数错误');
    const order = (await this.query('SELECT * FROM `kuyou_user_order` WHERE `user_id` = ? AND `order_num` = ?', [userId, orderNum]))[0];
    if (!order) throw new BadRequestException('未找到相关信息');
    switch (this.num(order.status)) {
      case 0:
        throw new BadRequestException('此订单未审核，不可确认收货');
      case 1:
      case 2:
        throw new BadRequestException('此订单未发货，不可确认收货');
      case 3: {
        const r = await this.query('UPDATE `kuyou_user_order` SET `status` = 4 WHERE `id` = ? AND `user_id` = ?', [order.id, userId]);
        if ((r as any).affectedRows) return true;
        throw new BadRequestException('确认收货失败，请稍后再试');
      }
      case 4:
        throw new BadRequestException('此订单已收货，不可重复收货');
      case 5:
        throw new BadRequestException('此订单已申请退款，不可确认收货');
      case 6:
        throw new BadRequestException('此订单已退款，不可确认收货');
      case 7:
        throw new BadRequestException('此订单已取消，不可确认收货');
      case 8:
        throw new BadRequestException('此订单已完成，不可确认收货');
      default:
        throw new BadRequestException('状态异常，不可确认收货');
    }
  }

  async cancelOrder(userId: number, orderNum: string) {
    if (!orderNum) throw new BadRequestException('参数错误');
    const order = (await this.query('SELECT * FROM `kuyou_user_order` WHERE `user_id` = ? AND `order_num` = ?', [userId, orderNum]))[0];
    if (!order) throw new BadRequestException('未找到相关信息');
    switch (this.num(order.status)) {
      case 0: {
        const r = await this.query('DELETE FROM `kuyou_user_order` WHERE `id` = ? AND `user_id` = ?', [order.id, userId]);
        // 同时清理订货单明细
        await this.query('DELETE FROM `kuyou_user_orderinfo` WHERE `order_id` = ?', [order.id]);
        if ((r as any).affectedRows) return true;
        throw new BadRequestException('取消订单失败，请稍后再试');
      }
      case 1:
      case 2:
        throw new BadRequestException('此订单待发货，不可取消');
      case 3:
        throw new BadRequestException('此订单已发货，不可取消');
      case 4:
        throw new BadRequestException('此订单已收货，不可取消');
      case 5:
        throw new BadRequestException('此订单已申请退款，不可取消');
      case 6:
        throw new BadRequestException('此订单已退款，不可取消');
      case 7:
        throw new BadRequestException('此订单已取消，不可取消');
      case 8:
        throw new BadRequestException('此订单已完成，不可取消');
      default:
        throw new BadRequestException('状态异常，不可取消');
    }
  }

  /* ===================== 微信相关 ===================== */

  /**
   * 微信小程序 code→session（对齐 PHP getWxMiniProgramSessionKey）
   * 需要环境变量 WX_MINI_APPID / WX_MINI_SECRET；未配置时给出明确错误。
   */
  async wxSessionKey(code: string, autoLogin: boolean) {
    const appid = process.env.WX_MINI_APPID;
    const secret = process.env.WX_MINI_SECRET;
    if (!appid || !secret) throw new BadRequestException('未配置微信小程序 appid/secret');
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
    const res: any = await httpsGet(url);
    if (!res || res.errcode) throw new BadRequestException(res && res.errmsg ? res.errmsg : '微信登录失败');
    const openid = res.openid;
    let oauth = (await this.query('SELECT * FROM `kuyou_user_oauth` WHERE `provider` = ? AND `platform` = ? AND `openid` = ? AND `user_id` > 0', ['Wechat', 'wxMiniPrograms', openid]))[0];
    let user: any = null;
    if (oauth) {
      user = (await this.query('SELECT * FROM `kuyou_user` WHERE `id` = ?', [oauth.user_id]))[0];
      if (!user) {
        await this.query('DELETE FROM `kuyou_user_oauth` WHERE `id` = ?', [oauth.id]);
        oauth = null;
      } else if (user.status !== 'normal') {
        throw new BadRequestException('账户已禁用');
      }
    }
    if (autoLogin && oauth && user) {
      const token = await this.signToken(user.id, user.username);
      return { token, session_key: res.session_key, openid };
    }
    return { session_key: res.session_key, openid };
  }

  /**
   * 微信小程序登录（对齐 PHP wxMiniProgramOauth）
   * 优先使用 openid；否则用 session_key + iv 解密 encryptedData 取出 openid 与用户信息。
   */
  async wxOauth(payload: { openid?: string; session_key?: string; iv?: string; encryptedData?: string; userInfo?: any }) {
    let openid = payload.openid;
    let userInfo = payload.userInfo;
    if (!openid && payload.session_key && payload.encryptedData && payload.iv) {
      try {
        const dec = this.decryptWxData(payload.session_key, payload.iv, payload.encryptedData);
        openid = dec.openId || dec.openid;
        if (!userInfo) userInfo = dec;
      } catch (e) {
        throw new BadRequestException('微信数据解析失败');
      }
    }
    if (!openid) throw new BadRequestException('code错误,请重试');
    let oauth = (await this.query('SELECT * FROM `kuyou_user_oauth` WHERE `provider` = ? AND `platform` = ? AND `openid` = ?', ['Wechat', 'wxMiniPrograms', openid]))[0];
    let user: any = null;
    if (oauth && oauth.user_id) {
      user = (await this.query('SELECT * FROM `kuyou_user` WHERE `id` = ?', [oauth.user_id]))[0];
    }
    if (!user) {
      const salt = randomStr(8);
      const pwd = this.encryptPassword(randomStr(8), salt);
      const nickname = userInfo && (userInfo.nickName || userInfo.nickname) ? userInfo.nickName || userInfo.nickname : openid;
      const avatar = userInfo && userInfo.avatarUrl ? userInfo.avatarUrl : '';
      const res = await this.query(
        'INSERT INTO `kuyou_user` (`username`,`password`,`salt`,`nickname`,`avatar`,`status`,`jointime`,`logintime`) VALUES (?,?,?,?,?,?,?,?)',
        [openid, pwd, salt, nickname, avatar, 'normal', this.now(), this.now()],
      );
      const id = (res as any).insertId;
      user = (await this.query('SELECT * FROM `kuyou_user` WHERE `id` = ?', [id]))[0];
      await this.query(
        'INSERT INTO `kuyou_user_oauth` (`provider`,`platform`,`openid`,`user_id`,`createtime`,`logintime`,`expiretime`) VALUES (?,?,?,?,?,?,?)',
        ['Wechat', 'wxMiniPrograms', openid, id, this.now(), this.now(), this.now() + 7200],
      );
    }
    const token = await this.signToken(user.id, user.username);
    const userinfo = this.userInfoShape(user);
    userinfo.token = token;
    return { token, userinfo };
  }

  /** 解密微信小程序加密数据（AES-128-CBC，PKCS7） */
  private decryptWxData(sessionKey: string, iv: string, encryptedData: string): any {
    const key = Buffer.from(sessionKey, 'base64');
    const ivBuf = Buffer.from(iv, 'base64');
    const data = Buffer.from(encryptedData, 'base64');
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, ivBuf);
    decipher.setAutoPadding(true);
    let decoded = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(decoded.toString('utf8'));
  }

  async bind(userId: number, mobile: string) {
    const customer = (await this.query('SELECT `id` FROM `kuyou_customers` WHERE `customer_mobile` = ?', [mobile]))[0];
    if (!customer) throw new BadRequestException('此手机号尚未成为客户，不可绑定');
    await this.query(
      'UPDATE `kuyou_user` SET `binding`=1,`customers_id`=?,`username`=?,`mobile`=? WHERE `id` = ?',
      [customer.id, mobile, mobile, userId],
    );
    return true;
  }

  /** 短信验证码（开发模式直接返回验证码；生产环境接入服务商） */
  private static smsCodes = new Map<string, { code: string; expire: number }>();

  async sendSms(mobile: string): Promise<{ dev_code?: string; msg: string }> {
    if (!/^\d{11}$/.test(mobile || '')) throw new BadRequestException('手机号格式错误');
    const code = String(Math.floor(100000 + Math.random() * 900000));
    OrderService.smsCodes.set(mobile, { code, expire: this.now() + 300 });
    if (process.env.SMS_ENABLED === 'true') {
      // TODO: 接入真实短信服务商（阿里云/腾讯云）后在此发送
      throw new BadRequestException('短信服务未配置');
    }
    return { dev_code: code, msg: '开发模式：验证码已返回，生产环境请接入短信服务商' };
  }

  /** 校验短信验证码（供 resetpwd / changemobile / bind 复用） */
  verifySms(mobile: string, code: string): boolean {
    const rec = OrderService.smsCodes.get(mobile);
    if (!rec) return false;
    if (rec.expire < this.now()) {
      OrderService.smsCodes.delete(mobile);
      return false;
    }
    if (rec.code !== String(code)) return false;
    OrderService.smsCodes.delete(mobile);
    return true;
  }

  /* ===================== 上传 ===================== */

  async saveUpload(file: any): Promise<{ url: string; fullurl: string; name: string }> {
    if (!file) throw new BadRequestException('未接收到上传文件');
    const dir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ext = path.extname(file.originalname || '').toLowerCase();
    const name = `${Date.now()}_${randomStr(10)}${ext}`;
    fs.writeFileSync(path.join(dir, name), file.buffer);
    const base = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : '';
    return { url: `/uploads/${name}`, fullurl: `${base}/uploads/${name}`, name: file.originalname };
  }

  /* ===================== 微信支付（JSAPI，对齐 PHP wxpay/notify） ===================== */

  private async wxPayConfig() {
    const rows = await this.query('SELECT `value`,`name` FROM `kuyou_user_sets` WHERE `name` IN (?,?,?)', ['appid', 'mch_id', 'pay_key']);
    const map: Record<string, string> = {};
    rows.forEach((r: any) => (map[r.name] = r.value));
    if (!map.appid || !map.mch_id || !map.pay_key) throw new BadRequestException('系统未开启支付功能');
    return map;
  }

  /** 统一下单（对齐 PHP wxpay） */
  async wxpay(userId: number, orderNum: string) {
    if (this.empty(orderNum)) throw new BadRequestException('请选择要支付的订单');
    const order = (await this.query('SELECT * FROM `kuyou_user_order` WHERE `order_num` = ? AND `user_id` = ? AND `pay_status` = 0', [orderNum, userId]))[0];
    if (!order) throw new BadRequestException('未找到相关订单');
    const openidRow = (await this.query('SELECT `openid` FROM `kuyou_user_oauth` WHERE `user_id` = ? AND `provider` = ? AND `platform` = ?', [userId, 'Wechat', 'wxMiniPrograms']))[0];
    if (!openidRow || !openidRow.openid) throw new BadRequestException('请先绑定微信或通过微信登陆');
    const cfg = await this.wxPayConfig();
    const nonceStr = randomStr(32);
    const timeStamp = String(Math.floor(Date.now() / 1000));
    const body = '订货通付款';
    const params: Record<string, string> = {
      appid: cfg.appid,
      mch_id: cfg.mch_id,
      nonce_str: nonceStr,
      body,
      out_trade_no: order.order_num,
      total_fee: String(Math.round(this.num(order.order_price) * 100)),
      spbill_create_ip: '127.0.0.1',
      notify_url: process.env.WX_NOTIFY_URL || '',
      trade_type: 'JSAPI',
      openid: openidRow.openid,
    };
    const sign = this.wxSign(params, cfg.pay_key);
    const xml = objToXml({ xml: { ...params, sign } });
    const result: any = await httpsPost('https://api.mch.weixin.qq.com/pay/unifiedorder', xml);
    if (result.return_code !== 'SUCCESS' || result.result_code !== 'SUCCESS') {
      throw new BadRequestException('微信下单失败: ' + (result.return_msg || result.err_code_des || ''));
    }
    const pkg = 'prepay_id=' + result.prepay_id;
    const paySign = this.wxSign(
      { appId: cfg.appid, nonceStr, package: pkg, signType: 'MD5', timeStamp },
      cfg.pay_key,
    );
    return {
      config: { nonceStr, timeStamp, package: pkg, paySign, signType: 'MD5', appId: cfg.appid },
      url: result.prepay_id,
    };
  }

  /** 支付回调（对齐 PHP notify） */
  async wxNotify(xml: string) {
    const data: any = xmlToObj(xml);
    if (data.return_code !== 'SUCCESS') return '<xml><return_code><![CDATA[FAIL]]></return_code></xml>';
    const cfg = await this.wxPayConfig().catch(() => null);
    if (cfg && !this.wxSignCheck(data, cfg.pay_key)) {
      return '<xml><return_code><![CDATA[FAIL]]></return_code></xml>';
    }
    const orderNum = data.out_trade_no;
    const order = (await this.query('SELECT * FROM `kuyou_user_order` WHERE `order_num` = ?', [orderNum]))[0];
    if (order && this.num(order.pay_status) !== 1) {
      await this.query('UPDATE `kuyou_user_order` SET `pay_status` = 1 WHERE `id` = ?', [order.id]);
    }
    return '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_code><![CDATA[OK]]></return_code></xml>';
  }

  private wxSign(params: Record<string, string>, key: string): string {
    const keys = Object.keys(params).filter((k) => params[k] !== '' && params[k] !== undefined).sort();
    const str = keys.map((k) => `${k}=${params[k]}`).join('&') + `&key=${key}`;
    return crypto.createHash('md5').update(str).digest('hex').toUpperCase();
  }

  private wxSignCheck(data: any, key: string): boolean {
    const sign = data.sign;
    delete data.sign;
    const calc = this.wxSign(data, key);
    return sign === calc;
  }
}

/* ===================== 通用辅助函数 ===================== */

function unitListIdSafe(map: Record<string, number>, unit: any): boolean {
  return Object.prototype.hasOwnProperty.call(map, unit);
}

function round2(v: number, decimal: number): number {
  return Math.round(v * Math.pow(10, decimal)) / Math.pow(10, decimal);
}

function randomStr(len: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function dateYmdHis(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function httpsGet(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

function httpsPost(url: string, data: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method: 'POST', headers: { 'Content-Type': 'text/xml' } },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve(xmlStringToObj(body)));
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function objToXml(obj: any): string {
  let xml = '<xml>';
  for (const k of Object.keys(obj.xml)) {
    xml += `<${k}>${obj.xml[k]}</${k}>`;
  }
  return xml + '</xml>';
}

function xmlToObj(xml: string): any {
  const obj: any = {};
  const re = /<(\w+)><!\[CDATA\[(.*?)\]\]><\/(\w+)>|<(\w+)>(.*?)<\/(\w+)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[2] !== undefined) obj[m[1]] = m[2];
    else obj[m[4]] = m[5];
  }
  return obj;
}

function xmlStringToObj(xml: string): any {
  return xmlToObj(xml);
}
