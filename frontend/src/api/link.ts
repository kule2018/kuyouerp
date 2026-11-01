/**
 * 上游单据联动 API（后端 src/modules/erp/link）
 *
 * 源系统在单据表单里通过「引入源单」把上游单据的明细带到当前单据：
 * 领料单引生产单、生产单引计划、委外单引计划、核销单引往来／应收／应付／预付。
 * 后端已实现对应的 choselist / pickinfo / planinfo / chose* 系列接口，
 * 这里统一封装，供 config/source-docs.ts 按单据声明后由 SourceDocPicker 调用。
 *
 * 接口约定（源 FastAdmin 行为，后端保持兼容）：
 *  - 不带单号   → 返回可分页的上游单据列表 { total, rows }
 *  - 带单号     → 返回该单据的明细行 { total, rows }
 *
 * @module api/link
 */
import request from '../utils/request';

/** 分页 + 业务过滤参数 */
export interface LinkParams {
  /** 页码，从 1 开始 */
  page?: number;
  /** 每页条数 */
  limit?: number;
  /** 上游单据编号；传入即切换为「取明细」模式 */
  purchase_code?: string;
  /** 往来单位过滤（核销类接口用） */
  customers_id?: number | string;
  suppliers_id?: number | string;
  /** 其他业务参数透传 */
  [k: string]: any;
}

/** 统一的分页结果 */
export interface LinkTable<T = any> {
  total: number;
  rows: T[];
}

/**
 * 从后端响应里取出 { total, rows }。
 *
 * 后端不同接口的包装层数不一致（裸对象 / {code,data} / {total,rows}），
 * 这里统一归一化，避免每个调用点各写一遍兼容逻辑。
 *
 * @param res 接口原始响应
 * @returns 归一化后的 total 与 rows
 */
export function pickTable(res: any): LinkTable {
  // 逐层下钻 { code, data } 信封，最多两层
  let d: any = res;
  for (let i = 0; i < 2; i += 1) {
    if (d && typeof d === 'object' && !Array.isArray(d) && d.data !== undefined && d.total === undefined && d.rows === undefined) {
      d = d.data;
    }
  }
  if (Array.isArray(d)) return { total: d.length, rows: d };
  return { total: Number(d?.total ?? 0), rows: Array.isArray(d?.rows) ? d.rows : [] };
}

/* ------------------------- 生产链：上游单据选择 ------------------------- */

/** 领料单 → 引入上游生产单明细（源 picking/choselist） */
export function pickingChooseList(params: LinkParams) {
  return request.get('/picking/choselist', { params });
}

/** 生产单 → 引入上游生产计划明细（源 productions/choselist） */
export function productionsChooseList(params: LinkParams) {
  return request.get('/productions/choselist', { params });
}

/** 委外加工单 → 引入上游生产计划明细（源 outsourcing/choselist） */
export function outsourcingChooseList(params: LinkParams) {
  return request.get('/outsourcing/choselist', { params });
}

/** 生产计划单 → 选择主生产计划（源 plan/choseplan） */
export function planChoosePlan(params: LinkParams) {
  return request.get('/plan/choseplan', { params });
}

/** 补料单 → 按生产单号取领料明细（源 material/pickinfo） */
export function materialPickInfo(params: LinkParams) {
  return request.get('/material/pickinfo', { params });
}

/** 补料单 → 按生产单号取生产明细（源 material/proinfo） */
export function materialProInfo(params: LinkParams) {
  return request.get('/material/proinfo', { params });
}

/** 验收单 → 按单号取领料明细（源 Acceptance/pickinfo） */
export function acceptancePickInfo(params: LinkParams) {
  return request.get('/acceptance/pickinfo', { params });
}

/** 生产单 → 按计划单号展开 BOM（源 productions/planinfo） */
export function productionsPlanInfo(params: LinkParams) {
  return request.get('/productions/planinfo', { params });
}

/** 委外单 → 按计划单号展开 BOM（源 outsourcing/planinfo） */
export function outsourcingPlanInfo(params: LinkParams) {
  return request.get('/outsourcing/planinfo', { params });
}

/* ------------------------- 核销单：往来单据选择 ------------------------- */

/** 核销源单类型 */
export type WriteoffKind = 'list' | 'receivable' | 'copewith' | 'advancelist';

/** 源单类型 → 后端路径段 */
const WRITEOFF_PATH: Record<WriteoffKind, string> = {
  list: 'choselist',
  receivable: 'chosereceivable',
  copewith: 'chosecopewith',
  advancelist: 'choseadvancelist',
};

/**
 * 核销单选择源单
 *
 * 四类源单本质相同：按往来单位过滤未核销完的单据。
 *  - list        收款源单（预收冲应收）
 *  - receivable  应收单据
 *  - copewith    应付单据
 *  - advancelist 预付单据
 *
 * @param kind 源单类型
 * @param params 往来单位与分页参数
 */
export function writeoffSource(kind: WriteoffKind, params: LinkParams) {
  return request.get(`/writeoff/${WRITEOFF_PATH[kind]}`, { params });
}

/* ------------------------- 订单合并生成下游单据 ------------------------- */

/**
 * 采购订单 → 可生成购货单的明细校验（源 goods_purchase_order/checkPurchase）
 *
 * 后端按订单明细扣掉已入库数量，返回仍可入库的行；无剩余则直接报错。
 * 注意：后端读的是 body.exchange（沿用源端参数名），不是 order_id。
 *
 * @param orderId 采购订单主键
 * @returns { code: 订单编号, lines: 可入库明细 }
 */
export function checkPurchaseOrder(orderId: number | string) {
  return request.post('/goods_purchase_order/checkPurchase', { exchange: orderId, order_id: orderId });
}

/**
 * 销货订单 → 可生成销货单的明细校验（源 goods_sales_order/checkPurchase）
 * @param orderId 销货订单主键
 * @returns { code: 订单编号, lines: 可出库明细 }
 */
export function checkSalesOrder(orderId: number | string) {
  return request.post('/goods_sales_order/checkPurchase', { exchange: orderId, order_id: orderId });
}

/* ------------------------- 商品选择弹窗 ------------------------- */

/**
 * 商品选择弹窗数据（源 goods/chosegoods / choseGoods / getGoods）
 * @param params 关键字、分类、分页
 */
export function choseGoods(params: LinkParams) {
  return request.get('/goods/chosegoods', { params });
}

/** 销售商品选择：可带客户价（源 goods/chosesale） */
export function choseSale(params: LinkParams) {
  return request.get('/goods/chosesale', { params });
}

/**
 * 按商品编码取单位 / 属性 / 价格信息（源 goods/getUnit）
 * 明细行选中商品后用于回填单位与单价。
 */
export function goodsUnitInfo(params: LinkParams) {
  return request.get('/goods/getUnit', { params });
}
