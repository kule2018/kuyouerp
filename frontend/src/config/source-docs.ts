/**
 * 单据「引入源单」配置
 *
 * 源 kuyou 的各单据表单在录入时可以从上游单据带出明细，避免手工重录：
 *  - 领料单 ← 生产单明细          （picking/choselist）
 *  - 补料单 ← 生产单领料明细       （material/pickinfo）
 *  - 验收单 ← 生产单领料明细       （acceptance/pickinfo）
 *  - 生产单 ← 生产计划明细         （productions/choselist）
 *  - 生产单 ← 计划 BOM 展开        （productions/planinfo）
 *  - 委外单 ← 生产计划明细         （outsourcing/choselist）
 *  - 委外单 ← 计划 BOM 展开        （outsourcing/planinfo）
 *  - 计划单 ← 主生产计划           （plan/choseplan）
 *  - 核销单 ← 收款／应收／应付／预付源单（writeoff/chose*，共四类）
 *
 * 本文件只做声明，具体调接口与弹窗交互由 components/SourceDocPicker.vue 实现。
 *
 * @module config/source-docs
 */

/** 上游接口标识，运行时映射到 api/link.ts 里的具体函数 */
export type SourceApi =
  | 'picking'
  | 'productions'
  | 'outsourcing'
  | 'plan'
  | 'material'
  | 'material-pro'
  | 'acceptance'
  | 'productions-plan'
  | 'outsourcing-plan'
  | 'writeoff-list'
  | 'writeoff-receivable'
  | 'writeoff-copewith'
  | 'writeoff-advance';

/** 弹窗展示列 */
export interface SourceCol {
  /** 取值字段 */
  prop: string;
  /** 列标题 */
  label: string;
  /** 列宽（px） */
  width?: number;
  /** 枚举映射（如 purchase_type 转中文） */
  enumMap?: Record<string, string>;
  /** 是否为金额列（右对齐 + 两位小数） */
  money?: boolean;
}

/** 一张单据可用的一个源单类型 */
export interface SourceDocSpec {
  /** 按钮 / 弹窗标题文案，如「引入生产单」 */
  label: string;
  /** 上游接口标识 */
  api: SourceApi;
  /**
   * 交互模式：
   *  - doc-list  先列出上游单据，选中后钻取明细（列表行是主单）
   *  - by-code   手工输入上游单号，直接取明细
   *  - by-party  按当前表头的往来单位列出可核销源单（列表行即明细）
   */
  mode: 'doc-list' | 'by-code' | 'by-party';
  /** 上游单据编号字段（doc-list 钻取时回传；by-code 提示用） */
  codeField?: string;
  /** 上游单据列表列（doc-list / by-party 使用） */
  docCols?: SourceCol[];
  /** 明细列（选中后展示供勾选） */
  lineCols?: SourceCol[];
  /** 明细回填映射：当前明细字段 → 上游字段（缺省同名回填） */
  map?: Record<string, string>;
  /** 表头回填映射：当前表头字段 → 上游单据字段 */
  headMap?: Record<string, string>;
  /** 回填时写入的固定初始值，如核销已核金额写 0 */
  defaults?: Record<string, any>;
  /** 弹窗顶部提示语 */
  tip?: string;
  /** by-code 模式下单号的输入提示 */
  codePlaceholder?: string;
}

/** 明细行通用列（生产链各单据结构基本一致） */
const PRODUCTION_LINE_COLS: SourceCol[] = [
  { prop: 'goods_code', label: '商品编号', width: 130 },
  { prop: 'goods_name', label: '商品名称', width: 150 },
  { prop: 'goods_note', label: '规格', width: 110 },
  { prop: 'number', label: '数量', width: 90, money: true },
  { prop: 'basic_nmber', label: '基本数量', width: 100, money: true },
  { prop: 'unit_id', label: '单位', width: 80 },
  { prop: 'stores_id', label: '仓库', width: 90 },
  { prop: 'remark', label: '备注', width: 140 },
];

/** 上游主单列表列：生产单 */
const PRODUCTION_DOC_COLS: SourceCol[] = [
  { prop: 'purchase_code', label: '生产单号', width: 170 },
  { prop: 'plan_code', label: '计划单号', width: 170 },
  { prop: 'purchase_time', label: '生产日期', width: 170 },
  { prop: 'goods_name', label: '产品名称', width: 150 },
  { prop: 'number', label: '计划产量', width: 100 },
  { prop: 'examine_status', label: '审核', width: 80, enumMap: { '0': '未审核', '1': '已审核' } },
];

/** 上游主单列表列：生产计划 */
const PLAN_DOC_COLS: SourceCol[] = [
  { prop: 'purchase_code', label: '计划单号', width: 170 },
  { prop: 'purchase_time', label: '计划日期', width: 170 },
  { prop: 'delivery_time', label: '交货日期', width: 170 },
  { prop: 'goods_name', label: '产品名称', width: 150 },
  { prop: 'number', label: '计划数量', width: 100 },
  { prop: 'examine_status', label: '审核', width: 80, enumMap: { '0': '未审核', '1': '已审核' } },
];

/** 核销源单列表列（后端已把 purchase_type 翻成中文，故不再做枚举映射） */
const WRITEOFF_DOC_COLS: SourceCol[] = [
  { prop: 'purchase_code', label: '单据编号', width: 170 },
  { prop: 'purchase_type', label: '单据类型', width: 120 },
  { prop: 'purchase_time', label: '单据日期', width: 150 },
  { prop: 'pay_money', label: '单据金额', width: 110, money: true },
  { prop: 'write_off', label: '未核金额', width: 110, money: true },
];

/**
 * 核销明细回填映射
 *
 * 源单（kuyou_writeoff_source）与核销明细（kuyou_writeoff_info）字段名不同，
 * 这里显式对齐；money 取源单的未核销金额，write_off 初始为 0（本次核销金额由用户填）。
 */
const WRITEOFF_MAP: Record<string, string> = {
  purchase_code: 'purchase_code',
  purchase_type: 'purchase_type',
  purchase_time: 'purchase_time',
  business_name: 'purchase_code',
  source_id: 'id',
  money: 'write_off',
  write_off: '',
};

/** 核销明细固定初值：本次核销金额从 0 起，业务类型默认 1 */
const WRITEOFF_DEFAULTS: Record<string, any> = {
  write_off: 0,
  write_off_money: 0,
  times: 1,
  type: 1,
};

export const SOURCE_DOCS: Record<string, SourceDocSpec[]> = {
  /* ---------------- 生产链 ---------------- */

  /** 领料单：引入生产单明细 */
  kuyou_picking: [
    {
      label: '引入生产单',
      api: 'picking',
      mode: 'doc-list',
      codeField: 'purchase_code',
      docCols: PRODUCTION_DOC_COLS,
      lineCols: PRODUCTION_LINE_COLS,
      tip: '选择已审核的生产单，勾选需要领料的商品行带入本单',
    },
  ],

  /** 补料单：按生产单号取领料明细 */
  kuyou_material: [
    {
      label: '引入生产单',
      api: 'material',
      mode: 'by-code',
      codeField: 'purchase_code',
      lineCols: PRODUCTION_LINE_COLS,
      tip: '输入生产单号后带出该单的领料明细',
      codePlaceholder: '请输入生产单号',
    },
  ],

  /** 验收单：按生产单号取领料明细 */
  kuyou_acceptance: [
    {
      label: '引入生产单',
      api: 'acceptance',
      mode: 'by-code',
      codeField: 'purchase_code',
      lineCols: PRODUCTION_LINE_COLS,
      tip: '输入生产单号后带出该单的领料明细，验收数量按实际填写',
      codePlaceholder: '请输入生产单号',
    },
  ],

  /** 生产单：引入生产计划明细，或按计划展开 BOM */
  kuyou_production: [
    {
      label: '引入生产计划',
      api: 'productions',
      mode: 'doc-list',
      codeField: 'purchase_code',
      docCols: PLAN_DOC_COLS,
      lineCols: PRODUCTION_LINE_COLS,
      headMap: { plan_code: 'purchase_code', goods_code: 'goods_code', goods_name: 'goods_name' },
      tip: '选择已审核的生产计划，勾选需要生产的商品行带入本单',
    },
    {
      label: '按计划展开BOM',
      api: 'productions-plan',
      mode: 'by-code',
      codeField: 'purchase_code',
      lineCols: PRODUCTION_LINE_COLS,
      tip: '输入计划单号，按 BOM 结构展开子件明细',
      codePlaceholder: '请输入计划单号',
    },
  ],

  /** 委外加工单：引入生产计划明细，或按计划展开 BOM */
  kuyou_outsourcing: [
    {
      label: '引入生产计划',
      api: 'outsourcing',
      mode: 'doc-list',
      codeField: 'purchase_code',
      docCols: PLAN_DOC_COLS,
      lineCols: PRODUCTION_LINE_COLS,
      tip: '选择已审核的生产计划，勾选需要委外的商品行带入本单',
    },
    {
      label: '按计划展开BOM',
      api: 'outsourcing-plan',
      mode: 'by-code',
      codeField: 'purchase_code',
      lineCols: PRODUCTION_LINE_COLS,
      tip: '输入计划单号，按 BOM 结构展开子件明细',
      codePlaceholder: '请输入计划单号',
    },
  ],

  /** 生产计划单：选择主生产计划 */
  kuyou_plan: [
    {
      label: '选择生产计划',
      api: 'plan',
      mode: 'doc-list',
      codeField: 'purchase_code',
      docCols: PLAN_DOC_COLS,
      lineCols: PRODUCTION_LINE_COLS,
      tip: '选择已审核的生产计划，勾选商品行带入本单',
    },
  ],

  /* ---------------- 核销单：四类源单 ---------------- */

  kuyou_writeoff: [
    {
      label: '选择收款源单',
      api: 'writeoff-list',
      mode: 'by-party',
      docCols: WRITEOFF_DOC_COLS,
      lineCols: WRITEOFF_DOC_COLS,
      map: WRITEOFF_MAP,
      defaults: WRITEOFF_DEFAULTS,
      tip: '按当前单据的客户筛选可核销的收款类源单',
    },
    {
      label: '选择应收单据',
      api: 'writeoff-receivable',
      mode: 'by-party',
      docCols: WRITEOFF_DOC_COLS,
      lineCols: WRITEOFF_DOC_COLS,
      map: WRITEOFF_MAP,
      defaults: WRITEOFF_DEFAULTS,
      tip: '按当前单据的客户筛选未核销完的应收单据',
    },
    {
      label: '选择应付单据',
      api: 'writeoff-copewith',
      mode: 'by-party',
      docCols: WRITEOFF_DOC_COLS,
      lineCols: WRITEOFF_DOC_COLS,
      map: WRITEOFF_MAP,
      defaults: WRITEOFF_DEFAULTS,
      tip: '按当前单据的供应商筛选未核销完的应付单据',
    },
    {
      label: '选择预付单据',
      api: 'writeoff-advance',
      mode: 'by-party',
      docCols: WRITEOFF_DOC_COLS,
      lineCols: WRITEOFF_DOC_COLS,
      map: WRITEOFF_MAP,
      defaults: WRITEOFF_DEFAULTS,
      tip: '按当前单据的供应商筛选可核销的预付类源单',
    },
  ],
};

/**
 * 取某张单据可用的源单配置
 * @param table 单据主表名（路由 :table，注意用物理表 key）
 * @returns 源单配置数组，无配置返回空数组
 */
export function sourceDocsOf(table: string): SourceDocSpec[] {
  return SOURCE_DOCS[table] || [];
}
