import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { DynamicCrudService } from '../dynamic-crud/dynamic-crud.service';
import { TABLE_META } from '../../../table-meta';

const JWT_SECRET = process.env.JWT_SECRET || 'kuyou-nestjs-rebuild-secret';

/** 生产小程序各业务分组 → 物理表映射 */
const TABLE: Record<string, { master: string; info?: string; code?: string; prefix?: string }> = {
  productions: { master: 'kuyou_production', info: 'kuyou_production_info', code: 'production_code', prefix: 'SC' },
  plan: { master: 'kuyou_plan', info: 'kuyou_plan_info', code: 'plan_code', prefix: 'JH' },
  procedure: { master: 'kuyou_bom_procedure' },
  bom: { master: 'kuyou_bom', info: 'kuyou_bom_info' },
  picking: { master: 'kuyou_picking', info: 'kuyou_picking_info', code: 'picking_code', prefix: 'LL' },
  material: { master: 'kuyou_material', info: 'kuyou_material_info', prefix: 'TL' },
  outsourcing: { master: 'kuyou_outsourcing', info: 'kuyou_outsourcing_info', code: 'outsourcing_code', prefix: 'WW' },
  acceptance: { master: 'kuyou_acceptance', info: 'kuyou_acceptance_info' },
  mrps: { master: 'kuyou_mrp', info: 'kuyou_mrp_info' },
  customers: { master: 'kuyou_customers' },
  staff_member: { master: 'kuyou_staff_member' },
  workshop: { master: 'kuyou_workshop' },
  unit: { master: 'kuyou_unit' },
  stores: { master: 'kuyou_stores' },
  factory: { master: 'kuyou_factory' },
  auxiliary: { master: 'kuyou_auxiliary' },
  goods_purchase: { master: 'kuyou_goods_purchase' },
  unit_conversion: { master: 'kuyou_unit_conversion' },
  inventory_serial: { master: 'kuyou_inventory_serial' },
  acceptances: { master: 'kuyou_acceptance' },
};

/** 公开（无需登录）的分组 / 动作 */
const PUBLIC_GROUPS = new Set([
  'goods', 'goods_purchase', 'inventory_serial', 'unit_conversion', 'workshop',
  'customers', 'unit', 'stores', 'factory', 'auxiliary', 'staff_member',
  'acceptances', 'wages', 'wageshour', 'procedure', 'bom', 'commons', 'sets', 'datainfo',
]);
const PUBLIC_ACTIONS = new Set(['index', 'getdetail', 'getGoodsList', 'getgoodsauxiliary', 'getgoodsinfo', 'formatInfo', 'getbranch', 'getSerial', 'getmenu', 'getcode', 'datainfo', 'getLastUser', 'getgoods', 'getgoodsinfo_c']);

@Injectable()
export class AppletService {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    private readonly jwt: JwtService,
    private readonly crud: DynamicCrudService,
  ) {}

  private num(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  private now(): number {
    return Math.floor(Date.now() / 1000);
  }
  private md5(s: string): string {
    return crypto.createHash('md5').update(s).digest('hex');
  }
  private genCode(prefix: string): string {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `${prefix}${ymd}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
  }

  /** 校验 token，失败返回 null */
  private verify(authHeader?: string): { id: number; username: string } | null {
    if (!authHeader) return null;
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    try {
      const p: any = this.jwt.verify(token, { secret: JWT_SECRET });
      return p && p.sub ? { id: p.sub, username: p.username } : null;
    } catch {
      return null;
    }
  }

  /** 登录：优先后台管理员，其次商城用户 */
  async login(account: string, password: string) {
    if (!account || !password) throw new BadRequestException('请输入账号和密码');
    // 后台管理员（FastAdmin md5(md5(pwd)+salt)）
    const admin = (await this.conn.query('SELECT * FROM `kuyou_admin` WHERE `username` = ?', [account]))[0];
    if (admin && admin.salt && admin.password === this.md5(this.md5(password) + admin.salt)) {
      const token = this.jwt.sign({ sub: admin.id, username: admin.username }, { secret: JWT_SECRET, expiresIn: '7200' });
      return { token, userinfo: { id: admin.id, username: admin.username, nickname: admin.nickname || admin.username, type: 'admin', token } };
    }
    // 商城用户
    const user = (await this.conn.query('SELECT * FROM `kuyou_user` WHERE `username` = ? OR `mobile` = ?', [account, account]))[0];
    if (user && user.salt && user.password === this.md5(this.md5(password) + user.salt)) {
      const token = this.jwt.sign({ sub: user.id, username: user.username }, { secret: JWT_SECRET, expiresIn: '7200' });
      return { token, userinfo: { id: user.id, username: user.username, nickname: user.nickname || user.username, type: 'user', token } };
    }
    throw new BadRequestException('账号或密码错误');
  }

  /** 统一分发 */
  async dispatch(group: string, action: string, body: any, authHeader?: string): Promise<any> {
    body = body || {};
    const needAuth = !PUBLIC_GROUPS.has(group) && !PUBLIC_ACTIONS.has(action);
    let user: { id: number; username: string } | null = null;
    if (needAuth) {
      user = this.verify(authHeader);
      if (!user) return { code: 401, msg: '请先登陆', data: null };
    }

    switch (group) {
      case 'user':
        if (action === 'login') return { code: 200, data: await this.login(body.account || body.username, body.password) };
        if (action === 'logout') return { code: 200, msg: '退出成功', data: null };
        break;
      case 'goods':
        return this.goods(action, body);
      case 'goods_purchase':
        if (action === 'getbranch') return this.okList(await this.conn.query('SELECT * FROM `kuyou_goods_purchase` WHERE `status` = 1 LIMIT 200'));
        break;
      case 'inventory_serial':
        if (action === 'getSerial') return this.okList(await this.conn.query('SELECT * FROM `kuyou_inventory_serial` WHERE `status` = 1 LIMIT 200'));
        break;
      case 'goods_exchange':
        if (action === 'getserial') return this.okList(await this.conn.query('SELECT * FROM `kuyou_inventory_serial` WHERE `status` = 1 LIMIT 200'));
        break;
      case 'unit_conversion':
        if (action === 'getdetail') return { code: 200, data: (await this.conn.query('SELECT * FROM `kuyou_unit_conversion` WHERE `id` = ?', [this.num(body.id)]))[0] || {} };
        break;
      case 'commons':
        return this.commons(action, body);
      case 'sets':
        return this.sets(action, body);
      case 'datainfo':
        if (action === 'datainfo') return this.datainfo();
        break;
      case 'wages':
        if (action === 'index') return this.wages('piece');
        break;
      case 'wageshour':
        if (action === 'index') return this.wages('hour');
        break;
      case 'acceptances':
        if (action === 'index') return this.tableList('kuyou_acceptance', body);
        break;
    }

    // 通用表 CRUD（生产单据 / 基础资料）
    const cfg = TABLE[group];
    if (!cfg) throw new BadRequestException(`未知业务: ${group}`);
    return this.tableOp(group, cfg, action, body, user);
  }

  /* ===================== 通用表操作 ===================== */
  private async tableOp(group: string, cfg: any, action: string, body: any, user: any): Promise<any> {
    const table = cfg.master;
    switch (action) {
      case 'index':
        return this.tableList(table, body);
      case 'getdetail': {
        const id = this.num(body.id);
        const row = await this.crud.detail(table, id);
        let list: any[] = [];
        if (cfg.info) {
          try {
            list = await this.conn.query(`SELECT * FROM \`${cfg.info}\` WHERE \`${cfg.code || 'id'}\` = ?`, [body[ cfg.code ] ?? row?.[cfg.code] ?? '']);
          } catch { list = []; }
        }
        return { code: 200, data: { info: row || {}, row: row || {}, list, rows: list } };
      }
      case 'add':
      case 'edit':
        return this.saveDoc(cfg, body);
      case 'del': {
        const r = await this.crud.del(table, Array.isArray(body.ids) ? body.ids.join(',') : (body.id != null ? String(body.id) : (body.ids || '')));
        return { code: 200, msg: '操作成功', data: r };
      }
      case 'examine':
      case 'acceptance':
        return this.examine(cfg, body);
      case 'planinfo':
      case 'proinfo':
      case 'pickinfo':
        return this.sourceLines(cfg, body);
      default:
        throw new BadRequestException(`未支持的动作: ${group}/${action}`);
    }
  }

  private async tableList(table: string, body: any): Promise<any> {
    const limit = Math.min(200, this.num(body.limit) || this.num(body.pageSize) || 15);
    const page = this.num(body.page) || this.num(body.pageNum) || 1;
    const offset = body.offset != null ? this.num(body.offset) : (page - 1) * limit;
    const q = {
      search: body.search || body.keyword || '',
      filter: body.filter,
      op: body.op,
      sort: body.sort,
      order: body.order,
      offset,
      limit,
    };
    const res = await this.crud.list(table, q);
    return { code: 200, data: { list: res.rows, rows: res.rows, total: res.total } };
  }

  /** 主从单据保存（主表 + 可选 goods_list 明细） */
  private async saveDoc(cfg: any, body: any): Promise<any> {
    const table = cfg.master;
    const pk = TABLE_META[table]?.pk || 'id';
    const isEdit = body[pk] != null && body[pk] !== '';
    // 自动生成业务单号
    if (!isEdit && cfg.code && !body[cfg.code]) {
      body[cfg.code] = this.genCode(cfg.prefix || 'DOC');
    }
    let saved: any;
    if (isEdit) saved = await this.crud.edit(table, body);
    else saved = await this.crud.add(table, body);
    const id = isEdit ? body[pk] : (saved[pk] || 0);
    const code = body[cfg.code] != null ? body[cfg.code] : null;

    // 明细行（goods_list）整体替换
    if (cfg.info && Array.isArray(body.goods_list)) {
      try {
        const cols = TABLE_META[cfg.info]?.columns || [];
        const linkCol = cfg.code && cols.includes(cfg.code) ? cfg.code : null;
        if (linkCol && code != null) {
          await this.conn.query(`DELETE FROM \`${cfg.info}\` WHERE \`${linkCol}\` = ?`, [code]);
        } else if (cols.includes(`${pk}`)) {
          await this.conn.query(`DELETE FROM \`${cfg.info}\` WHERE \`${pk}\` = ?`, [id]);
        }
        for (const line of body.goods_list) {
          const l: any = { ...line };
          if (linkCol) l[linkCol] = code;
          if (cols.includes(pk) && !l[pk]) l[pk] = id;
          // 透传通用外键（生产/领料/委外互相关联）
          for (const fk of ['production_code', 'picking_code', 'outsourcing_code', 'plan_code']) {
            if (cols.includes(fk) && body[fk] != null) l[fk] = body[fk];
          }
          const insCols = Object.keys(l).filter((c) => cols.includes(c));
          if (insCols.length) {
            await this.conn.query(
              `INSERT INTO \`${cfg.info}\` (${insCols.map((c) => `\`${c}\``).join(',')}) VALUES (${insCols.map(() => '?').join(',')})`,
              insCols.map((c) => l[c]),
            );
          }
        }
      } catch (e: any) {
        throw new BadRequestException('明细保存失败: ' + (e?.message || e));
      }
    }
    return { code: 200, msg: '操作成功', data: { id, code } };
  }

  /** 审核 / 验收：翻转 examine_status，缺列则翻 status */
  private async examine(cfg: any, body: any): Promise<any> {
    const table = cfg.master;
    const pk = TABLE_META[table]?.pk || 'id';
    const id = body.id != null ? this.num(body.id) : this.num(body[pk]);
    const state = body.state != null ? Number(body.state) : 1;
    const cols = TABLE_META[table]?.columns || [];
    const statusCol = cols.includes('examine_status') ? 'examine_status' : (cols.includes('status') ? 'status' : null);
    if (!statusCol) return { code: 200, msg: '操作成功', data: { id } };
    await this.conn.query(`UPDATE \`${table}\` SET \`${statusCol}\` = ? WHERE \`${pk}\` = ?`, [String(state), id]);
    return { code: 200, msg: '操作成功', data: { id, state } };
  }

  /** 源单明细（领料/退料/验收 拉取生产计划或生产单的商品明细） */
  private async sourceLines(cfg: any, body: any): Promise<any> {
    const code = body.code || body.production_code || body.plan_code || body.picking_code || '';
    let rows: any[] = [];
    if (cfg.info) {
      try {
        const linkCol = cfg.code || 'id';
        rows = await this.conn.query(`SELECT * FROM \`${cfg.info}\` WHERE \`${linkCol}\` = ?`, [code]);
      } catch { rows = []; }
    }
    return { code: 200, data: { list: rows, rows, code } };
  }

  /* ===================== 商品相关 ===================== */
  private async goods(action: string, body: any): Promise<any> {
    const id = this.num(body.goods_id || body.id);
    switch (action) {
      case 'getdetail': {
        const row = await this.crud.detail('kuyou_goods', id);
        return { code: 200, data: { info: row || {}, row: row || {} } };
      }
      case 'getGoodsList':
      case 'getgoods': {
        const limit = Math.min(200, this.num(body.limit) || 20);
        const page = this.num(body.page) || 1;
        const offset = (page - 1) * limit;
        let where = 'WHERE `status` = 1';
        const params: any[] = [];
        if (body.keyword) { where += ' AND (`goods_name` LIKE ? OR `goods_code` LIKE ?)'; params.push('%' + body.keyword + '%', '%' + body.keyword + '%'); }
        if (body.goods_type_id) { where += ' AND `goods_type_id` = ?'; params.push(body.goods_type_id); }
        const rows = await this.conn.query(`SELECT * FROM \`kuyou_goods\` ${where} ORDER BY \`id\` DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
        const total = (await this.conn.query(`SELECT COUNT(*) AS c FROM \`kuyou_goods\` ${where}`, params))[0].c;
        return { code: 200, data: { list: rows, rows, total } };
      }
      case 'getgoodsauxiliary': {
        const rows = await this.conn.query('SELECT * FROM `kuyou_goods_attr` WHERE `goods_id` = ?', [id]);
        return { code:200, data: { list: rows, rows } };
      }
      case 'formatInfo':
      case 'getgoodsinfo':
      case 'getgoodsinfo_c': {
        const row = await this.crud.detail('kuyou_goods', id);
        const unit = (await this.conn.query('SELECT * FROM `kuyou_goods_price` WHERE `goods_id` = ?', [id]))[0] || {};
        return { code: 200, data: { ...(row || {}), unit } };
      }
      case 'getLastUser':
        return { code: 200, data: {} };
      default:
        throw new BadRequestException(`未支持的商品动作: ${action}`);
    }
  }

  /* ===================== 公共 ===================== */
  private async commons(action: string, body: any): Promise<any> {
    if (action === 'getmenu') {
      return { code: 200, data: { menu: [] } };
    }
    if (action === 'getcode') {
      const prefix = body.prefix || 'CODE';
      return { code: 200, data: { code: this.genCode(prefix) } };
    }
    if (action === 'upload') {
      // 由控制器把文件转交
      return { code: 200, data: {} };
    }
    throw new BadRequestException(`未支持的公共动作: ${action}`);
  }

  private async sets(action: string, body: any): Promise<any> {
    if (action === 'index') {
      const rows = await this.conn.query('SELECT `name`,`value` FROM `kuyou_sets`');
      const map: any = {};
      rows.forEach((r: any) => (map[r.name] = r.value));
      return { code: 200, data: { sets: map, value: map } };
    }
    if (action === 'edit') {
      const name = body.name;
      const value = body.value;
      if (!name) throw new BadRequestException('缺少 name');
      const exist = await this.conn.query('SELECT `id` FROM `kuyou_sets` WHERE `name` = ?', [name]);
      if (exist[0]) await this.conn.query('UPDATE `kuyou_sets` SET `value` = ? WHERE `name` = ?', [value, name]);
      else await this.conn.query('INSERT INTO `kuyou_sets` (`name`,`value`) VALUES (?, ?)', [name, value]);
      return { code: 200, msg: '操作成功', data: null };
    }
    throw new BadRequestException(`未支持的设置动作: ${action}`);
  }

  private async datainfo(): Promise<any> {
    const goods = (await this.conn.query('SELECT COUNT(*) AS c FROM `kuyou_goods` WHERE `status` = 1'))[0].c;
    const plan = (await this.conn.query('SELECT COUNT(*) AS c FROM `kuyou_plan`'))[0].c;
    const production = (await this.conn.query('SELECT COUNT(*) AS c FROM `kuyou_production`'))[0].c;
    const acceptance = (await this.conn.query('SELECT COUNT(*) AS c FROM `kuyou_acceptance`'))[0].c;
    return { code: 200, data: { goods, plan, production, acceptance } };
  }

  /** 工资：计件 / 计时，由验收单 + 工序单价计算 */
  private async wages(type: 'piece' | 'hour'): Promise<any> {
    try {
      const acc = await this.conn.query('SELECT * FROM `kuyou_acceptance` ORDER BY `id` DESC LIMIT 200');
      const list = acc.map((a: any) => {
        const wageField = type === 'piece' ? 'wages' : 'wages_hour';
        const rate = Number(a[wageField] || 0);
        const qty = type === 'piece' ? Number(a.number || 0) : Number(a.hours || 0);
        return { ...a, wage_rate: rate, wage_total: Math.round(rate * qty * 100) / 100 };
      });
      return { code: 200, data: { list, rows: list, total: list.length } };
    } catch (e: any) {
      return { code: 200, data: { list: [], rows: [], total: 0 } };
    }
  }

  private okList(rows: any[]): any {
    return { code: 200, data: { list: rows, rows, total: rows.length } };
  }

  /** 文件上传（由控制器调用） */
  async saveUpload(file: any): Promise<any> {
    if (!file) throw new BadRequestException('未接收到上传文件');
    const dir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ext = path.extname(file.originalname || '').toLowerCase();
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}${ext}`;
    fs.writeFileSync(path.join(dir, name), file.buffer);
    const base = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : '';
    return { code: 200, data: { url: `/uploads/${name}`, fullurl: `${base}/uploads/${name}`, name: file.originalname } };
  }
}
