/**
 * 通用 CRUD 页的表级扩展配置
 *
 * 源系统中少量基础资料页在标准 增/删/改/查 之外带有专属能力：
 *  - 库存盘点：工具栏「导出盘点」（源 inventory/export 直接下载 xlsx）
 *  - 用户订单：搜索栏状态下拉 + 时间区间、列表按订单号合并单元格（源 layui tableMerge）、
 *    商品级展开列，以及行内「审核 / 发货 / 生成销货单」（源 user_order.js 行工具）
 * 这里按表名集中声明，crud.vue 读取后渲染对应按钮、列与合并规则。
 */

/** 工具栏扩展按钮 */
export interface ToolbarExtra {
  /** 按钮文案 */
  label: string;
  /** 按钮类型（Element-Plus） */
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default';
  /** 动作标识，crud.vue 据此分发 */
  action: 'inventory-export';
}

/** 行内扩展操作（按行数据条件显示） */
export interface RowExtra {
  label: string;
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  action: 'user-order-examine' | 'user-order-deliver' | 'user-order-sales' | 'inventory-check';
  /** 显示条件：行数据满足时才渲染 */
  when: (row: any) => boolean;
}

/** 列表展示列覆盖（源页面列集与物理表列不一致时使用） */
export interface DisplayCol {
  prop: string;
  label: string;
  width?: number;
  /** 值 → 中文 映射（源 templet 枚举展示，如订单状态 0=待审核） */
  enumMap?: Record<string, string>;
  /** 图片列：渲染为缩略图（源 goods_image 列） */
  image?: boolean;
}

/** 状态下拉等精确筛选项（源搜索栏 select，提交时下推后端 filter/op） */
export interface ListFilter {
  prop: string;
  label: string;
  options: { label: string; value: any }[];
}

/** 每张表的扩展声明 */
export interface TableExtras {
  toolbar?: ToolbarExtra[];
  row?: RowExtra[];
  /** 列表展示列覆盖；缺省用模块元数据列 */
  listCols?: DisplayCol[];
  /** 状态下拉筛选项 */
  filters?: ListFilter[];
  /** 时间区间筛选（源 laydate range，转换时间戳后走后端 BETWEEN） */
  dateRange?: { prop: string; label: string };
  /**
   * 列表合并字段（源 layui tableMerge 的 merge:['order_num']）。
   * 用户订单一行一个商品，同一订单的多行由后端富化保证相邻；
   * 具体哪些列参与合并由 crud.vue 按组内数据稳定性自动判定
   * （组内取值完全一致的列才合并，商品级字段保持独立）。
   */
  mergeBy?: string;
}

export const TABLE_EXTRAS: Record<string, TableExtras> = {
  /* 库存盘点：导出盘点模板（源 inventory/export）+ 行内「生成盘单单据」（源 inventory.js exchange） */
  kuyou_inventory: {
    toolbar: [{ label: '导出盘点', type: 'success', action: 'inventory-export' }],
    row: [{ label: '生成盘单单据', type: 'primary', action: 'inventory-check', when: () => true }],
  },

  /* 序列号盘点：与库存盘点共用的「生成盘单单据」（源 inventory_serial.js exchange） */
  kuyou_inventory_serial: {
    row: [{ label: '生成盘单单据', type: 'primary', action: 'inventory-check', when: () => true }],
  },

  /* 通用附件：源页只展示图片 + 创建时间（原始单据缩略图预览） */
  kuyou_enclosure: {
    listCols: [
      { prop: 'id', label: 'ID', width: 80 },
      { prop: 'image', label: '原始单据', width: 140, image: true },
      { prop: 'type', label: '类型', width: 100, enumMap: { '1': '购货', '2': '销货' } },
      { prop: 'createtime', label: '上传时间', width: 180 },
    ],
  },

  /* 用户订单：列覆盖 + 状态/时间筛选 + 按订单号合并 + 行内工具（源 user_order.js） */
  kuyou_user_order: {
    listCols: [
      { prop: 'order_num', label: '订单号', width: 180 },
      { prop: 'goods_code', label: '商品编号', width: 120 },
      { prop: 'goods_name', label: '商品名称', width: 140 },
      { prop: 'goods_image', label: '商品图片', width: 90, image: true },
      { prop: 'unit_name', label: '单位', width: 80 },
      { prop: 'attr_name', label: '属性', width: 100 },
      { prop: 'price', label: '商品单价', width: 100 },
      { prop: 'number', label: '商品数量', width: 90 },
      { prop: 'order_price', label: '订单总计', width: 100 },
      { prop: 'status', label: '订单状态', width: 100, enumMap: { '0': '待审核', '1': '已审核', '2': '待发货', '3': '待收货', '4': '已收货' } },
      { prop: 'pay_status', label: '支付状态', width: 100, enumMap: { '0': '待支付', '1': '已支付', '2': '支付失败' } },
      { prop: 'name', label: '收货人', width: 100 },
      { prop: 'diver_type', label: '配送类型', width: 100, enumMap: { '1': '专业配送', '2': '到店自取' } },
      { prop: 'diver_name', label: '配送人', width: 100 },
      { prop: 'phone', label: '联系电话', width: 120 },
      { prop: 'address', label: '收货地址', width: 200 },
    ],
    filters: [
      {
        prop: 'status',
        label: '订单状态',
        options: [
          { label: '待审核', value: 0 },
          { label: '待发货', value: 2 },
          { label: '待收货', value: 3 },
          { label: '已收货', value: 4 },
        ],
      },
    ],
    dateRange: { prop: 'createtime', label: '下单时间' },
    mergeBy: 'order_num',
    row: [
      { label: '审核', type: 'primary', action: 'user-order-examine', when: (r) => Number(r.status) === 0 },
      {
        label: '发货',
        type: 'success',
        action: 'user-order-deliver',
        when: (r) => Number(r.status) === 2 && r.sales_id !== null && r.sales_id !== undefined && r.sales_id !== '',
      },
      {
        label: '生成销货单',
        type: 'warning',
        action: 'user-order-sales',
        when: (r) => Number(r.status) === 2 && (r.sales_id === null || r.sales_id === undefined || r.sales_id === ''),
      },
    ],
  },
};

/** 取某张表的扩展配置（无配置返回空） */
export function extrasOf(table: string): TableExtras {
  return TABLE_EXTRAS[table] || {};
}
