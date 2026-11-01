import request from '../utils/request';

/**
 * 零售收银台 API（后端 src/modules/erp/retail）
 * 路由与原 kuyou 收银台（retail/goods_sales.php）一致：
 *  - init          收银台初始化（公司名 / 结算账户 / 小数位）
 *  - getGoodsList  商品网格（POST，客户等级价 + 多单位 + 辅助属性）
 *  - checkout      POS 结算（types=ls，双单号 + 自动过账）
 *  - examine       零售单审核 / 反审核（examine=1|2）
 */

/** 收银台初始化 */
export function posInit() {
  return request.get('/retail/goods_sales/init');
}

/**
 * 商品网格
 * @param params { keyword, goods_type_id, tag, customers_id, page, limit }
 */
export function posGoods(params: {
  keyword?: string;
  goods_type_id?: number;
  tag?: string;
  customers_id?: number;
  page?: number;
  limit?: number;
}) {
  return request.post('/retail/goods_sales/getGoodsList', params);
}

/**
 * POS 结算（源 add types=ls）
 * @param body { customers_id, account_id, all_money(实收), note, goods_list(JSON 字符串) }
 */
export function posCheckout(body: {
  customers_id: number;
  account_id: number;
  all_money: number;
  note?: string;
  goods_list: string;
}) {
  return request.post('/retail/goods_sales/add', { types: 'ls', ...body });
}

/** 零售单审核 / 反审核 */
export function posExamine(ids: string, state: 0 | 1) {
  return request.post(`/retail/goods_sales/examine?examine=${state === 1 ? 1 : 2}&ids=${encodeURIComponent(ids)}`, {});
}
