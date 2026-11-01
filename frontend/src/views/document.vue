<template>
  <div class="doc-page">
    <!-- ============ 列表 ============ -->
    <DsCard v-show="!editing">
      <template #title>
        <div class="toolbar">
          <span class="title">{{ cfg?.title || table }}</span>
          <div class="grow" />
          <DsInput
            v-model="keyword"
            placeholder="单据编号 / 备注"
            clearable
            style="width: 220px"
            @keyup.enter="loadList"
            @clear="loadList"
          />
          <DsSelect
            v-if="cfg?.statusField"
            v-model="statusFilter"
            :options="[{ label: '未审核', value: 0 }, { label: '已审核', value: 1 }]"
            placeholder="审核状态"
            clearable
            style="width: 140px"
            @change="loadList"
          />
          <DsButton variant="primary" @click="onCreate">新增单据</DsButton>
          <DsButton @click="loadList">刷新</DsButton>
          <!-- 收银台：源 retail/goods_sales 工具栏 lay-event="retail"，跳转 POS 收银页 -->
          <DsButton v-if="cfg?.pos" variant="ghost" @click="router.push('/pos')">收银台</DsButton>
          <!-- 合并生成下游单据：源 lay-event="merge_b"（采购订单→购货单 / 销货订单→销货单） -->
          <DsButton v-if="selected.length && cfg?.merge" variant="primary" @click="onMerge">
            {{ cfg.merge.label }}（{{ selected.length }}）
          </DsButton>
          <!-- 批量操作：与源端 lay-event 工具栏（examine/counter/delAll/printss）一一对应 -->
          <DsButton v-if="selected.length" variant="ghost" @click="onBatchAudit(1)">批量审核</DsButton>
          <DsButton v-if="selected.length" variant="ghost" @click="onBatchAudit(0)">批量反审核</DsButton>
          <DsButton v-if="selected.length && counterable" variant="ghost" @click="onBatchCounter(1)">批量对单</DsButton>
          <DsButton v-if="selected.length && counterable" variant="ghost" @click="onBatchCounter(0)">批量反对单</DsButton>
          <DsButton v-if="selected.length" variant="ghost" class="danger-link" @click="onBatchDelete">批量删除</DsButton>
          <DsButton v-if="selected.length" variant="ghost" @click="onBatchPrint">打印选中</DsButton>
        </div>
      </template>

      <DsTable
        :columns="tableColumns"
        :data="rows"
        :loading="loading"
        striped
        row-key="id"
        selection
        reserve-selection
        @selection-change="(v: any[]) => (selected = v)"
      >
        <template v-for="c in listCols" :key="c.prop" #[c.prop]="{ row }">
          <DsTag v-if="c.prop === cfg?.statusField" :color="Number(row[c.prop]) === 1 ? 'success' : 'neutral'" size="sm">
            {{ Number(row[c.prop]) === 1 ? '已审核' : '未审核' }}
          </DsTag>
          <span v-else>{{ display(row, c.prop) }}</span>
        </template>
        <template #__op="{ row }">
          <DsButton variant="text" size="sm" @click="onEdit(row)">查看/编辑</DsButton>
          <DsButton variant="text" size="sm" @click="onRowPrint(row)">打印</DsButton>
          <DsButton variant="text" size="sm" class="danger-link" @click="onDelete(row)">删除</DsButton>
        </template>
      </DsTable>

      <DsPagination
        style="margin-top: 12px"
        layout="total, sizes, prev, pager, next"
        :total="total"
        v-model:currentPage="page"
        v-model:pageSize="limit"
        :page-sizes="[15, 30, 50, 100]"
        @change="loadList"
      />
    </DsCard>

    <!-- ============ 主从编辑 ============ -->
    <DsCard v-if="editing">
      <template #title>
        <div class="toolbar">
          <span class="title">{{ cfg?.title }} {{ form[pk] ? '编辑' : '新增' }}</span>
          <div class="grow" />
          <DsTag :color="Number(form[cfg?.statusField || '']) === 1 ? 'success' : 'neutral'" size="sm">
            {{ Number(form[cfg?.statusField || '']) === 1 ? '已审核' : '未审核' }}
          </DsTag>
          <DsButton @click="back">返回列表</DsButton>
          <DsButton variant="primary" :loading="saving" @click="onSave">保存</DsButton>
          <DsButton
            v-if="form[pk] && cfg?.statusField"
            :variant="Number(form[cfg.statusField]) === 1 ? 'ghost' : 'primary'"
            :class="{ 'danger-link': Number(form[cfg.statusField]) === 1 }"
            @click="onAudit"
          >
            {{ Number(form[cfg.statusField]) === 1 ? '反审核' : '审核' }}
          </DsButton>
          <DsButton
            v-if="form[pk] && counterable"
            :variant="Number(form.check_status) === 1 ? 'ghost' : 'primary'"
            @click="onCounter"
          >
            {{ Number(form.check_status) === 1 ? '反对单' : '对单' }}
          </DsButton>
          <!-- 引入源单：领料/生产/委外/核销等单据从上游单据带出明细（源 choselist / pickinfo） -->
          <DsButton v-if="sourceSpecs.length" variant="primary" @click="pickerVisible = true">引入源单</DsButton>
          <!-- 组装 / 拆卸单支持模板：另存为模板后可从模板带出全部明细 -->
          <DsButton v-if="templatable" variant="ghost" @click="onSaveTemp">另存为模板</DsButton>
          <DsButton v-if="templatable" variant="ghost" @click="onPickTemp">选择模板</DsButton>
        </div>
      </template>

      <!-- 模板选择对话框 -->
      <DsModal v-model="tempVisible" title="选择模板" :width="720">
        <DsTable :columns="tempColumns" :data="tempRows" striped clickable :height="380">
          <template #act="{ row }">
            <DsButton variant="text" size="sm" @click="applyTemp(row)">使用</DsButton>
          </template>
        </DsTable>
      </DsModal>

      <!-- 表头表单 -->
      <div class="head-form">
        <DsField v-for="f in headFields" :key="f" :label="labelOf(f)" :required="isHeadRequired(f)">
          <!-- 引用列：远端搜索选择器 -->
          <DsSelect
            v-if="refOf(f)"
            v-model="form[f]"
            :options="refOptions[f] || []"
            :placeholder="'请选择' + labelOf(f)"
            remote
            filterable
            clearable
            :loading="refLoading[f]"
            style="width: 100%"
            @search="(kw: string) => remoteSearch(f, kw)"
          />
          <!-- 时间列 -->
          <DsDatePicker
            v-else-if="isTimeCol(f)"
            v-model="form[f]"
            type="datetime"
            placeholder="选择日期时间"
            style="width: 100%"
          />
          <DsInput v-else-if="isNumCol(f)" v-model="form[f]" type="number" style="width: 100%" />
          <DsInput v-else v-model="form[f]" :placeholder="labelOf(f)" :disabled="f === pk && !form[pk]" />
        </DsField>
      </div>

      <!-- 明细行 -->
      <template v-if="docTable">
        <div class="line-bar">
          <span class="line-title">明细行</span>
          <DsButton size="sm" variant="primary" @click="addLine">增行</DsButton>
          <DsButton size="sm" @click="copyLastLine">复制末行</DsButton>
        </div>
        <DsTable :columns="lineColumns" :data="lines" striped :height="420">
          <template v-for="c in lineCols" :key="c.prop" #[c.prop]="{ row }">
            <!-- 商品/仓库等引用列：下拉选择 -->
            <DsSelect
              v-if="refOf(c.prop)"
              v-model="row[c.prop]"
              :options="optionsOf(c.prop, row)"
              size="sm"
              remote
              filterable
              clearable
              :loading="refLoading[c.prop]"
              @search="(kw: string) => remoteSearch(c.prop, kw, row)"
              @change="(v: any) => onRefPicked(c.prop, v, row)"
            />
            <DsInput
              v-else-if="isMoneyProp(c.prop) || isNumProp(c.prop)"
              v-model="row[c.prop]"
              type="number"
              :step="isMoneyProp(c.prop) ? 0.01 : 1"
              style="width: 100%"
              @change="recalc(row)"
            />
            <DsInput v-else v-model="row[c.prop]" size="sm" />
          </template>
          <template #__op="{ index }">
            <DsButton variant="text" size="sm" class="danger-link" @click="removeLine(index)">删除</DsButton>
          </template>
        </DsTable>
        <div class="foot">
          <span>行数：<b>{{ lines.length }}</b></span>
          <span>数量合计：<b>{{ sumOf(qtyProp) }}</b></span>
          <span>金额合计：<b>{{ money(sumOf(moneyProp)) }}</b></span>
        </div>
      </template>

      <!-- 原始单据附件：购货/销货类单据可上传凭证影像，按业务域归类展示 -->
      <div class="attach-block">
        <div class="line-bar">
          <span class="line-title">原始单据附件</span>
          <input ref="fileInput" type="file" accept="image/*" style="display: none" @change="onEnclosurePick" />
          <DsButton size="sm" variant="primary" @click="fileInput && fileInput.click()">上传附件</DsButton>
        </div>
        <div v-if="enclosureLoading" class="attach-empty">加载中…</div>
        <div v-else-if="enclosures.length" class="attach-list">
          <div class="attach-item" v-for="a in enclosures" :key="a.id">
            <img :src="a.image" class="attach-img" />
            <div class="attach-meta">
              <span>{{ a.upload_date || '—' }}</span>
              <DsButton variant="text" size="sm" class="danger-link" @click="removeEnclosure(a.id)">删除</DsButton>
            </div>
          </div>
        </div>
        <div v-else class="attach-empty">暂无附件，点击「上传附件」添加凭证影像</div>
      </div>
    </DsCard>

    <!-- 源单选择器：从上游单据带出明细 -->
    <SourceDocPicker
      v-model="pickerVisible"
      :specs="sourceSpecs"
      :head="form"
      @pick="onPickSource"
    />

    <!-- 模板名称输入框（替代 ElMessageBox.prompt） -->
    <DsModal v-model="tempNameVisible" title="另存为模板" :width="420">
      <DsField label="模板名称" required>
        <DsInput v-model="tempName" placeholder="请输入模板名称" @keyup.enter="closeTempName(tempName.trim() || null)" />
      </DsField>
      <template #footer>
        <DsButton @click="closeTempName(null)">取消</DsButton>
        <DsButton variant="primary" :disabled="!tempName.trim()" @click="closeTempName(tempName.trim())">确定</DsButton>
      </template>
    </DsModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from '@/components/ds/toast';
import { confirm } from '@/components/ds/useConfirm';
import { MODULES, type ModuleMeta } from '../config/modules';
import { docConfig, REF_MAP, type DocConfig } from '../config/documents';
import { docList, docDetail, docSave, docAudit, docCounter, docDel, docPrefill } from '../api/document';
import { saveTemp, getTemp } from '../api/recycle';
import * as api from '../api/dynamic';
import { physicalTableOf } from '../config/documents';
import { sourceDocsOf, type SourceDocSpec } from '../config/source-docs';
import { requiredOf } from '../config/required-fields';
import { checkPurchaseOrder, checkSalesOrder } from '../api/link';
import SourceDocPicker from '../components/SourceDocPicker.vue';
import { selectpage } from '../api/dynamic';
import { uploadEnclosure } from '../api/misc';

/* ------------------------------------------------------------------ *
 * 页面主流程
 * 1) 列表：按主表名走动态 CRUD 的 index 接口，支持编号搜索与审核状态过滤
 * 2) 编辑：表头字段由主表元数据生成，明细行为可编辑表格（含远端引用选择器）
 * 3) 保存：整体提交 { header, lines }，后端事务内一并落库
 * 4) 审核：调用 audit 接口，仓库类单据由后端联动增减库存
 * ------------------------------------------------------------------ */

const route = useRoute();
const router = useRouter();
const toast = useToast();
const table = ref(String(route.params.table || ''));
const cfg = ref<DocConfig | undefined>(docConfig(table.value));
const docTable = computed(() => cfg.value?.detail || '');

const metaOf = (t: string): ModuleMeta | undefined => MODULES.find((m) => m.key === t);
/**
 * 主表元数据。
 * 注意：零售单这类「按业务标识拆页」的单据，路由 key（kuyou_retail_sales）不是物理表名，
 * 必须取配置里的 header（kuyou_goods_sales）才能查到列元数据，否则列表列会全部为空。
 */
const headMeta = computed(() => metaOf(cfg.value?.header || table.value));
const lineMeta = computed(() => (docTable.value ? metaOf(docTable.value) : undefined));
const pk = computed(() => headMeta.value?.pk || 'id');

/** 表头字段是否必填（源表单 data-rule="required"） */
function isHeadRequired(prop: string): boolean {
  return requiredOf(cfg.value?.header || table.value).includes(prop);
}

/** 自动忽略的系统列 */
const SKIP = new Set(['admin_id', 'createtime', 'updatetime', 'deletetime', 'examine_id', 'operation_id', 'preparation_id', 'print_num']);

/** 时间列判定：列名以 time / date 结尾且类型为数字 */
function isTimeCol(p: string) {
  const c = headMeta.value?.columns.find((x) => x.prop === p);
  return !!c && /(_time|^checkdate)$/.test(p) && c.type === 'number';
}
function display(row: any, prop: string) {
  const v = row[prop];
  if (v === null || v === undefined || v === '') return '';
  if (isTimeCol(prop) && Number(v) > 0) {
    const d = new Date(Number(v) * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return String(v);
}

/** 秒级时间戳 → 'YYYY-MM-DD HH:mm:ss' 字符串（供日期选择器回显） */
function fmtTs(v: any): string {
  const d = new Date(Number(v) * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 列表列：优先展示单号 / 往来单位 / 金额 / 备注，其余按元数据顺序补足 */
const listCols = computed(() => {
  const m = headMeta.value;
  if (!m) return [];
  const prefer = [cfg.value?.codeField || 'purchase_code', 'purchase_time', 'supplyer_code', 'suppliers_id', 'customers_id', 'number', 'all_money', 'money', 'price', 'remarks', 'remark'];
  const all = m.columns.filter((c) => c.prop !== pk.value && !SKIP.has(c.prop));
  const picked = prefer.filter((p) => all.some((c) => c.prop === p));
  const rest = all.map((c) => c.prop).filter((p) => !picked.includes(p));
  const order = [...picked, ...rest].slice(0, 9);
  return order.map((p) => ({
    prop: p,
    label: labelOf(p),
    width: p === 'remarks' || p === 'remark' ? undefined : 140,
  }));
});

/** 列表列配置（序号 + 动态列 + 操作列） */
const tableColumns = computed(() => [
  { title: '#', key: '__idx', width: '60px', formatter: (_v: any, _r: any, i: number) => i + 1 },
  ...listCols.value.map((c) => ({
    title: c.label,
    key: c.prop,
    width: c.width ? c.width + 'px' : undefined,
    slot: true,
  })),
  { title: '操作', key: '__op', width: '270px', fixed: 'right' as const, slot: true },
]);

/** 模板选择表列 */
const tempColumns = [
  { title: '模板名称', key: 'temp_name', minWidth: '180px' },
  { title: '单据编号', key: 'purchase_code', minWidth: '160px' },
  { title: '金额', key: 'money', width: '110px' },
  { title: '备注', key: 'remark', minWidth: '140px' },
  { title: '操作', key: 'act', width: '90px', fixed: 'right' as const, slot: true },
];

/** 明细行列配置（序号 + 动态列 + 操作列） */
const lineColumns = computed(() => [
  { title: '#', key: '__idx', width: '55px', formatter: (_v: any, _r: any, i: number) => i + 1 },
  ...lineCols.value.map((c) => ({
    title: c.label,
    key: c.prop,
    width: c.width ? c.width + 'px' : undefined,
    slot: true,
  })),
  { title: '操作', key: '__op', width: '80px', fixed: 'right' as const, slot: true },
]);

/** 标签：优先中文注释，缺失则回退列名 */
function labelOf(prop: string) {
  const c = headMeta.value?.columns.find((x) => x.prop === prop) || lineMeta.value?.columns.find((x) => x.prop === prop);
  if (!c) return prop;
  return c.label && c.label !== prop ? String(c.label).split(':')[0] : prop;
}

/** 表头表单字段：优先取配置指定，缺省按元数据自动挑「业务字段」 */
const headFields = computed(() => {
  const m = headMeta.value;
  if (!m) return [];
  if (cfg.value?.headerFields?.length) return cfg.value.headerFields;
  const prefer = [cfg.value?.codeField || 'purchase_code', 'purchase_time', 'business_type', 'supplyer_code', 'suppliers_id', 'customers_id', 'accounts_id', 'stores_id', 'examine_status', 'check_status', 'money', 'all_money', 'remark', 'remarks'];
  const all = m.columns.filter((c) => c.prop !== pk.value && !SKIP.has(c.prop));
  const picked = prefer.filter((p) => all.some((c) => c.prop === p));
  const rest = all.map((c) => c.prop).filter((p) => !picked.includes(p));
  const base = [...picked, ...rest].slice(0, 15);
  // 订货单预取带入的字段（收货地址 / 订单金额等）补充进表单，保证可见并可保存
  const extra = prefillKeys.value.filter((p) => !base.includes(p) && all.some((c) => c.prop === p));
  return [...base, ...extra];
});

/**
 * 订货单预取带入的表头字段名（源 goods_sales/add?order_id=）。
 * 含非本表列（order_id 为瞬态字段，后端保存时用于回写订货单关联，不入库）。
 */
const prefillKeys = ref<string[]>([]);

/** 明细行列：由配置指定或元数据自动挑选 */
const lineCols = computed(() => {
  const m = lineMeta.value;
  if (!m) return [];
  const specified = cfg.value?.lineFields?.filter((p) => m.columns.some((c) => c.prop === p));
  if (specified?.length) return specified.map((p) => ({ prop: p, label: labelOf(p), width: 130 }));
  const all = m.columns.filter((c) => c.prop !== 'id' && !SKIP.has(c.prop) && c.prop !== cfg.value?.codeField);
  return all.slice(0, 12).map((c) => ({ prop: c.prop, label: c.label || c.prop, width: 130 }));
});

function isNumCol(p: string) {
  const c = headMeta.value?.columns.find((x) => x.prop === p);
  return !!c && c.type === 'number';
}
const isMoneyProp = (p: string) => /money|price|amount|tax|rate/.test(p) && p !== 'tax_rate';
const isNumProp = (p: string) => /^number$|_number$/.test(p);
const qtyProp = computed(() => (lineCols.value.some((c) => c.prop === 'number') ? 'number' : ''));
const moneyProp = computed(() => {
  const prefer = ['all_money', 'price', 'money', 'cost_money', 'tax_money'];
  return prefer.find((p) => lineCols.value.some((c) => c.prop === p)) || '';
});

/* ------------------------- 列表 ------------------------- */
const rows = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(15);
const keyword = ref('');
const statusFilter = ref<number | undefined>(undefined);
const loading = ref(false);
/** 列表勾选行（批量审核/对单/删除/打印用） */
const selected = ref<any[]>([]);

/**
 * 列表请求序号：连续翻页 / 快速改筛选时，先发的慢响应后到会覆盖新结果，
 * 用自增序号丢弃过期响应，保证视图里留下的永远是最后一次请求的数据。
 */
let listSeq = 0;

async function loadList() {
  const my = ++listSeq;
  loading.value = true;
  try {
    // 审核状态通过 filter/op 下推后端（JSON 字符串），编号走 search 快速搜索
    const params: any = {
      offset: (page.value - 1) * limit.value,
      limit: limit.value,
      sort: pk.value,
      order: 'DESC',
    };
    if (keyword.value) params.search = keyword.value;
    const sf = cfg.value?.statusField;
    if (sf && statusFilter.value !== undefined && statusFilter.value !== null) {
      params.filter = JSON.stringify({ [sf]: statusFilter.value });
      params.op = JSON.stringify({ [sf]: '=' });
    }
    const res: any = await docList(table.value, params);
    // 过期响应直接丢弃，避免覆盖后发起的请求结果
    if (my !== listSeq) return;
    rows.value = res?.data?.rows || res?.rows || [];
    total.value = Number(res?.data?.total || res?.total || 0);
  } catch (e: any) {
    if (my === listSeq) toast.error(e?.message || '列表加载失败');
  } finally {
    if (my === listSeq) loading.value = false;
  }
}

/* ------------------------- 编辑 ------------------------- */
const editing = ref(false);
const saving = ref(false);
const form = reactive<Record<string, any>>({});
const lines = ref<any[]>([]);

/* ---------------- 原始单据附件 ---------------- */
/**
 * 附件按业务域归类（源 kuyou_enclosure.type：1=购货类，2=销货/零售类）。
 * 当前 enclosure 表仅以 type 区分，未绑定具体单据编号，因此这里按业务域聚合展示，
 * 与 crud.vue 中「采购附件 / 销售附件」两页思路一致。
 */
const fileInput = ref<HTMLInputElement | null>(null);
const enclosures = ref<any[]>([]);
const enclosureLoading = ref(false);
const enclosureType = computed(() => (/sales|retail/.test(String(table.value || '')) ? '2' : '1'));

/** 加载当前业务域下的附件列表 */
async function loadEnclosures() {
  enclosureLoading.value = true;
  try {
    const params = {
      filter: JSON.stringify({ type: enclosureType.value, status: '1' }),
      op: JSON.stringify({ type: '=', status: '=' }),
      sort: 'id',
      order: 'DESC',
      limit: 100,
    };
    const res: any = await api.list('kuyou_enclosure', params);
    enclosures.value = res?.rows || [];
  } catch {
    enclosures.value = [];
  } finally {
    enclosureLoading.value = false;
  }
}

/** 选择文件后上传，并写入 kuyou_enclosure */
async function onEnclosurePick(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const res: any = await uploadEnclosure(file);
    const url = res?.data?.url || res?.url;
    if (!url) throw new Error('上传失败');
    const now = Math.floor(Date.now() / 1000);
    await api.add('kuyou_enclosure', {
      image: url,
      type: enclosureType.value,
      status: '1',
      upload_date: new Date().toISOString().slice(0, 10),
      createtime: now,
      updatetime: now,
    });
    toast.success('附件上传成功');
    await loadEnclosures();
  } catch (err: any) {
    toast.error(err?.message || '上传失败');
  }
}

/** 删除附件 */
async function removeEnclosure(id: any) {
  if (!(await confirm('确认删除该附件？', '提示'))) return;
  try {
    await api.del('kuyou_enclosure', String(id));
    enclosures.value = enclosures.value.filter((x) => x.id !== id);
    toast.success('已删除');
  } catch (err: any) {
    toast.error(err?.message || '删除失败');
  }
}

function emptyRow() {
  const o: Record<string, any> = {};
  for (const c of lineMeta.value?.columns || []) o[c.prop] = null;
  return o;
}

function addLine() {
  lines.value.push(emptyRow());
}
function copyLastLine() {
  const last = lines.value[lines.value.length - 1];
  lines.value.push(last ? { ...last } : emptyRow());
}
function removeLine(i: number) {
  lines.value.splice(i, 1);
}

/** 金额联动：数量 × 单价 → 金额（存在对应列时生效） */
function recalc(row: any) {
  const mg = cfg.value?.money;
  if (mg && row[mg.qty] !== undefined && row[mg.price] !== undefined) {
    const q = Number(row[mg.qty] || 0);
    const p = Number(row[mg.price] || 0);
    row[mg.money] = Number((q * p).toFixed(2));
  } else if (row.number !== undefined && row.unit_price !== undefined && 'all_money' in row) {
    row.all_money = Number((Number(row.number || 0) * Number(row.unit_price || 0)).toFixed(2));
  }
}

function sumOf(prop: string) {
  if (!prop) return 0;
  return Number(
    lines.value.reduce((s, r) => s + (Number(r[prop]) || 0), 0).toFixed(2),
  );
}
function money(v: number) {
  return Number(v || 0).toFixed(2);
}

function back() {
  editing.value = false;
  loadList();
}

async function onCreate() {
  Object.keys(form).forEach((k) => delete form[k]);
  for (const p of headFields.value) form[p] = isTimeCol(p) ? '' : null;
  lines.value = docTable.value ? [emptyRow()] : [];
  prefillKeys.value = [];
  editing.value = true;
  loadEnclosures();
}

/**
 * 订货单转销货单预取（源 goods_sales/add?order_id=）。
 * 从用户订单页点「生成销货单」跳转过来时，按 order_id 带出客户、收货地址
 * 与商品明细，直接进入新增编辑态；order_id 随保存提交，由后端回写订货单关联。
 */
async function prefillFromQuery() {
  const orderId = route.query.order_id;
  if (!orderId) return;
  try {
    const res: any = await docPrefill(table.value, String(orderId));
    const data = res?.data || res || {};
    const head = data.header || {};
    // 表头：预取字段全部入 form（含瞬态 order_id），本表列同时补进表单可见
    prefillKeys.value = Object.keys(head);
    Object.keys(form).forEach((k) => delete form[k]);
    for (const p of headFields.value) form[p] = isTimeCol(p) ? '' : null;
    for (const [k, v] of Object.entries(head)) form[k] = v;
    // 明细：按订货单商品行带出（含单位换算进率，由后端预取完成）
    lines.value = (data.lines || []).map((r: any) => ({ ...emptyRow(), ...r }));
    if (!lines.value.length && docTable.value) lines.value = [emptyRow()];
    editing.value = true;
    // 客户下拉回显：预取的 customers_id 可能不在首屏选项中，补一条合成选项
    if (head.customer_name !== undefined && head.customers_id !== undefined && head.customers_id !== null) {
      await remoteSearch('customers_id', '');
      const list = refOptions['customers_id'] || (refOptions['customers_id'] = []);
      if (!list.some((o) => String(o.value) === String(head.customers_id))) {
        list.push({ label: String(head.customer_name || head.customers_id), value: head.customers_id });
      }
    }
    toast.success('已按订货单带出明细，请核对后保存');
  } catch (e: any) {
    toast.error(e?.response?.data?.msg || e?.message || '订货单预取失败');
  }
}

async function onEdit(row: any) {
  Object.keys(form).forEach((k) => delete form[k]);
  const res: any = await docDetail(table.value, row[pk.value]);
  const head = res?.data?.header || res?.header || {};
  for (const p of headFields.value) {
    const v = head[p];
    // 时间列转字符串（日期选择器只接受字符串模型）
    form[p] = isTimeCol(p) && v ? fmtTs(v) : v ?? null;
  }
  form[pk.value] = head[pk.value];
  lines.value = (res?.data?.lines || res?.lines || []).map((r: any) => ({ ...emptyRow(), ...r }));
  editing.value = true;
  loadEnclosures();
}

async function onSave() {
  // 必填校验：源表单 data-rule="required" 的表头字段不允许为空
  const missing = requiredOf(cfg.value?.header || table.value).filter((p) => {
    if (!headFields.value.includes(p)) return false;
    const v = form[p];
    return v === null || v === undefined || String(v).trim() === '';
  });
  if (missing.length) {
    toast.warning(`请填写：${missing.map((p) => labelOf(p)).join('、')}`);
    return;
  }
  saving.value = true;
  try {
    // 时间列统一转成字符串，后端负责转秒级时间戳；剔除空主键
    const header: Record<string, any> = {};
    for (const p of headFields.value) {
      let v = form[p];
      if (isTimeCol(p)) {
        if (v instanceof Date) v = v.toISOString().slice(0, 19).replace('T', ' ');
        if (typeof v === 'number') v = fmtTs(v);
      }
      if (v !== undefined) header[p] = v;
    }
    if (form[pk.value]) header[pk.value] = form[pk.value];
    // 订货单预取的瞬态字段（order_id 等非本表列）随表头提交，供后端回写关联
    for (const k of prefillKeys.value) {
      const v = form[k];
      if (v !== undefined && v !== null && v !== '') header[k] = v;
    }
    const res: any = await docSave(table.value, header, lines.value);
    const d = res?.data || res;
    if (d?.id) form[pk.value] = d.id;
    toast.success(res?.msg || '保存成功');
    back();
  } catch (e: any) {
    toast.error(e?.response?.data?.msg || e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function onAudit() {
  const state = Number(form[cfg.value?.statusField || '']) === 1 ? 0 : 1;
  if (!(await confirm(
    state === 1 ? '确认审核？仓库类单据将同步增减库存，资金类单据将联动账户余额与往来欠款' : '确认反审核？库存将按原方向冲回，资金数据整体冲回',
    '提示',
  ))) return;
  try {
    await docAudit(table.value, form[pk.value], state);
    toast.success(state === 1 ? '审核成功' : '反审核成功');
    await onEdit({ [pk.value]: form[pk.value] });
  } catch (e: any) {
    toast.error(e?.response?.data?.msg || e?.message || '操作失败');
  }
}

/* 对单 / 反对单：购销类单据的核对动作，只翻 check_status，不过账不动库存 */
const counterable = computed(() => {
  const c = cfg.value;
  return !!c && /kuyou_goods_(purchase|sales|exchange|sales_exchange)/.test(c.header);
});

async function onCounter() {
  const state = Number(form.check_status) === 1 ? 0 : 1;
  if (!(await confirm(state === 1 ? '确认对单？' : '确认反对单？', '提示'))) return;
  try {
    await docCounter(table.value, form[pk.value], state);
    toast.success(state === 1 ? '对单成功' : '反对单成功');
    await onEdit({ [pk.value]: form[pk.value] });
  } catch (e: any) {
    toast.error(e?.response?.data?.msg || e?.message || '操作失败');
  }
}

/* ---------------- 引入源单（从上游单据带出明细） ---------------- */

/** 当前单据可引入的源单类型（空数组 = 该单据无源单可引，按钮不渲染） */
const sourceSpecs = computed<SourceDocSpec[]>(() => sourceDocsOf(cfg.value?.header || table.value));

/** 源单选择器开关 */
const pickerVisible = ref(false);

/** 明细表真实列集合：引入时裁掉上游独有字段，避免脏字段混进保存请求 */
const lineColSet = computed(() => new Set((lineMeta.value?.columns || []).map((c) => c.prop)));

/**
 * 判断明细行是否已有内容
 * @param r 明细行
 * @returns 任一非空业务字段即视为已填
 */
function isRowFilled(r: Record<string, any>): boolean {
  return Object.entries(r).some(([k, v]) => !k.startsWith('__') && v !== null && v !== undefined && v !== '');
}

/**
 * 源单带入结果处理
 *
 * 当前明细只有空行时直接替换，否则追加到末尾，避免覆盖用户已录入的行。
 * 上游字段先按本单据明细表的列裁剪再补齐，保证表格能正常渲染与保存。
 *
 * @param payload lines=映射后的明细行，head=需回写的表头字段
 * @returns 无
 */
function onPickSource(payload: { lines: Record<string, any>[]; head: Record<string, any>; spec: SourceDocSpec }) {
  const { lines: src, head } = payload;
  if (!src.length) return;
  const keep = lineColSet.value;
  const incoming = src.map((r) => {
    const base = emptyRow();
    for (const [k, v] of Object.entries(r)) {
      if (keep.has(k)) base[k] = v;
    }
    return base;
  });
  const hasContent = lines.value.some((r) => isRowFilled(r));
  lines.value = hasContent ? [...lines.value, ...incoming] : incoming;
  // 表头回写（如生产单从计划带出产品编号）；只写表单已有的字段，避免出现不可见字段
  for (const [k, v] of Object.entries(head)) {
    if (k in form) form[k] = v;
  }
  // 金额联动重算：上游金额优先，但数量/单价变化后需保持一致
  lines.value.forEach((r) => recalc(r));
  toast.success(`已带入 ${incoming.length} 行明细`);
}

/* ---------------- 单据模板（仅组装单 / 拆卸单） ---------------- */
/** 当前单据是否支持模板：assemble=组装，split=拆卸，其余返回 '' */
const templatable = computed<'assemble' | 'split' | ''>(() => {
  const t = String(table.value || '');
  if (/kuyou_assemble/.test(t)) return 'assemble';
  if (/kuyou_split/.test(t)) return 'split';
  return '';
});

/** 模板业务名 → 模板主表 */
const tempTable = computed(() => (templatable.value === 'split' ? 'kuyou_split_temp' : 'kuyou_assemble_temp'));

const tempVisible = ref(false);
const tempRows = ref<any[]>([]);

/* 模板名称输入框（替代 ElMessageBox.prompt） */
const tempNameVisible = ref(false);
const tempName = ref('');
let tempNameResolve: ((name: string | null) => void) | null = null;

/** 弹出模板名称输入框，确定返回名称，取消返回 null */
function askTempName(): Promise<string | null> {
  tempName.value = '';
  tempNameVisible.value = true;
  return new Promise((resolve) => {
    tempNameResolve = resolve;
  });
}

/** 关闭名称输入框并回传结果 */
function closeTempName(name: string | null) {
  tempNameVisible.value = false;
  tempNameResolve?.(name);
  tempNameResolve = null;
}

/**
 * 另存为模板：把当前表头 + 明细行转成后端期望的「列数组」结构后提交。
 * 后端要求 row 内为 goods_code[] / goods_unit[] / number[] 等数组形式。
 */
async function onSaveTemp() {
  const biz = templatable.value;
  if (!biz) return;
  const name = (await askTempName())?.trim();
  if (!name) return;
  try {
    const row: Record<string, any> = { ...form };
    // 明细行按列拆成数组
    for (const k of Object.keys(lines.value[0] || {})) {
      row[k] = lines.value.map((r: any) => r[k]);
    }
    await saveTemp(biz, name, row);
    toast.success('模板保存成功');
  } catch (e: any) {
    toast.error(e?.response?.data?.msg || e?.message || '保存失败');
  }
}

/** 打开模板选择：模板主表走通用 CRUD 列表接口 */
async function onPickTemp() {
  try {
    const res: any = await api.list(tempTable.value, { limit: 100, sort: 'id', order: 'desc' });
    tempRows.value = res.rows || [];
    tempVisible.value = true;
  } catch (e: any) {
    toast.error(e?.response?.data?.msg || e?.message || '加载失败');
  }
}

/**
 * 应用模板：用模板明细覆盖当前明细行，并把表头的金额 / 备注一并带出。
 */
async function applyTemp(row: any) {
  const biz = templatable.value;
  if (!biz) return;
  try {
    const res: any = await getTemp(biz, row.id);
    const data = res?.data || res || {};
    const info = data.info || [];
    lines.value = info.map((r: any) => ({ ...r }));
    // 表头字段：金额与备注来自模板主表
    if (data.temp) {
      if (data.temp.money !== undefined && data.temp.money !== null) form.costs = data.temp.money;
      if (data.temp.remark !== undefined && data.temp.remark !== null) form.note = data.temp.remark;
    }
    tempVisible.value = false;
    toast.success(`已载入模板「${row.temp_name}」，共 ${info.length} 行`);
  } catch (e: any) {
    toast.error(e?.response?.data?.msg || e?.message || '载入失败');
  }
}

async function onDelete(row: any) {
  if (!(await confirm('确认删除该单据？明细行将一并删除', '提示'))) return;
  try {
    // 删除落到物理主表：零售单等虚拟 key 需指向真实表
    await docDel(physicalTableOf(table.value), row[pk.value]);
    toast.success('删除成功');
    // 清空勾选：被删行若残留在 selected 里，后续批量审核/删除会对失效 id 发请求
    selected.value = [];
    loadList();
  } catch (e: any) {
    toast.error(e?.response?.data?.msg || e?.message || '删除失败');
  }
}

/* ------------------- 批量操作（源 lay-event: examine / counter / delAll / printss） ------------------- */

/** 勾选行主键数组 */
const selectedIds = () => selected.value.map((r: any) => r[pk.value]).filter((v: any) => v !== undefined && v !== null);

/**
 * 批量审核 / 反审核
 * 已审核单据再次审核会被后端拒绝，这里逐条调用并汇总成功数。
 * @param state 1=审核 0=反审核
 */
async function onBatchAudit(state: 0 | 1) {
  const ids = selectedIds();
  if (!ids.length) return toast.warning('请先勾选单据');
  if (!(await confirm(
    `确认对 ${ids.length} 张单据执行「${state === 1 ? '审核' : '反审核'}」？${state === 1 ? '审核将联动库存与资金' : '反审核将整体冲回'}`,
    '提示',
  ))) return;
  let ok = 0;
  const errs: string[] = [];
  for (const id of ids) {
    try {
      await docAudit(table.value, id, state);
      ok += 1;
    } catch (e: any) {
      errs.push(`${id}: ${e?.response?.data?.msg || e?.message || '失败'}`);
    }
  }
  if (ok) toast.success(`${state === 1 ? '审核' : '反审核'}成功 ${ok} 张`);
  if (errs.length) toast.error(`${errs.length} 张失败：${errs[0]}`);
  loadList();
}

/**
 * 批量对单 / 反对单
 * 只翻核对位，不过账不动库存；仅购销类单据开放。
 * @param state 1=对单 0=反对单
 */
async function onBatchCounter(state: 0 | 1) {
  const ids = selectedIds();
  if (!ids.length) return toast.warning('请先勾选单据');
  let ok = 0;
  const errs: string[] = [];
  for (const id of ids) {
    try {
      await docCounter(table.value, id, state);
      ok += 1;
    } catch (e: any) {
      errs.push(`${id}: ${e?.response?.data?.msg || e?.message || '失败'}`);
    }
  }
  if (ok) toast.success(`${state === 1 ? '对单' : '反对单'}成功 ${ok} 张`);
  if (errs.length) toast.error(`${errs.length} 张失败：${errs[0]}`);
  loadList();
}

/**
 * 合并生成下游单据（源 lay-event="merge_b"）
 *
 * 勾选多张订单 → 逐张校验可生成数量（后端按已生成量扣减）→ 汇总明细
 * → 以草稿形式交接给目标单据页（sessionStorage）→ 跳转后自动带入。
 * 已全部生成的订单后端会直接报错，这里跳过并在结束时汇总提示。
 *
 * @returns 无
 */
async function onMerge() {
  const m = cfg.value?.merge;
  if (!m) return;
  const ids = selectedIds();
  if (!ids.length) return toast.warning('请先勾选订单');
  const action = m.label.replace(/^合并/, '');
  if (!(await confirm(`确认将选中的 ${ids.length} 张订单合并生成「${action}」？未生成完的数量会一并带入`, '提示'))) return;

  const isPurchase = /goods_purchase_order/.test(cfg.value?.header || table.value);
  const picked = selected.value;
  const allLines: any[] = [];
  const labels: Record<string, Record<string, string>> = { goods_code: {} };
  const head: Record<string, any> = {};
  let okCount = 0;
  const errs: string[] = [];

  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    const row = picked[i] || {};
    try {
      const res: any = isPurchase ? await checkPurchaseOrder(id) : await checkSalesOrder(id);
      const d = res?.data || res;
      const ls = d?.lines || [];
      if (!ls.length) continue;
      okCount += 1;
      for (const ln of ls) {
        allLines.push(ln);
        if (ln.goods_code) labels.goods_code[String(ln.goods_code)] = String(ln.goods_name || ln.goods_code);
      }
      // 表头取第一张订单的往来单位与仓库；多张订单不一致时以第一张为准，用户可再改
      if (!Object.keys(head).length) {
        for (const p of ['suppliers_id', 'customers_id', 'stores_id', 'supplyer_code', 'customers_code']) {
          const v = row[p];
          if (v !== undefined && v !== null && v !== '') head[p] = v;
        }
      }
    } catch (e: any) {
      const code = row[cfg.value?.codeField || 'purchase_code'] || id;
      errs.push(`${code}：${e?.response?.data?.msg || e?.message || '不可生成'}`);
    }
  }

  if (!allLines.length) {
    toast.error(errs[0] || '选中订单没有可生成的数量');
    return;
  }
  sessionStorage.setItem(`ds-doc-draft:${m.target}`, JSON.stringify({ lines: allLines, labels, head }));
  if (errs.length) toast.warning(`${errs.length} 张订单跳过：${errs[0]}`);
  toast.success(`已合并 ${okCount} 张订单共 ${allLines.length} 行，正在打开${action}`);
  router.push(`/doc/${m.target}`);
}

/** 批量删除：逐条删除主单（明细由后端级联清理） */
async function onBatchDelete() {
  const ids = selectedIds();
  if (!ids.length) return toast.warning('请先勾选单据');
  if (!(await confirm(`确认删除选中的 ${ids.length} 张单据？明细行将一并删除`, '提示'))) return;
  let ok = 0;
  for (const id of ids) {
    try {
      await docDel(physicalTableOf(table.value), id);
      ok += 1;
    } catch {
      /* 单条失败不中断，最终按成功数提示 */
    }
  }
  toast.success(`删除成功 ${ok} 张`);
  selected.value = [];
  loadList();
}

/**
 * 打印：跳转到打印页并带上单据 ID（源为 lay-event="printss" 打开打印弹窗）
 * @param row 不传则使用当前勾选行
 */
function onBatchPrint(row?: any) {
  const ids = row ? [row[pk.value]] : selectedIds();
  if (!ids.length) return toast.warning('请先勾选单据');
  router.push({ name: 'prints', query: { type: table.value.replace(/^kuyou_/, ''), ids: ids.join(',') } });
}

function onRowPrint(row: any) {
  onBatchPrint(row);
}

/* ------------------- 引用列远端搜索 ------------------- */
const refOptions = reactive<Record<string, { label: string; value: any }[]>>({});
/** 远端搜索命中的原始记录：选中时按 value 反查，用于回填商品单价/单位等附加属性 */
const refRows = reactive<Record<string, any[]>>({});
const refLoading = reactive<Record<string, boolean>>({});

/**
 * 批次选项按「行」隔离。
 * refOptions 是按列缓存的：若两行是不同商品，后打开批次下拉的那一行会覆盖前一行的
 * 候选项，前一行再打开时首屏会短暂显示别的商品的批次。批次改为以行对象为键单独缓存，
 * 行被删除或顺序变化时都不受影响（WeakMap 随行对象自动释放，无泄漏）。
 */
const rowBatchRows = new WeakMap<any, any[]>();
const rowBatchOptions = new WeakMap<any, { label: string; value: any }[]>();

/** 某列的候选项：批次列优先取行级缓存，其余列取列级缓存 */
function optionsOf(col: string, row: any) {
  if (col === 'batch_id') return rowBatchOptions.get(row) || refOptions[col] || [];
  return refOptions[col] || [];
}

function refOf(col: string) {
  return REF_MAP[col];
}

/**
 * 远端搜索引用数据（商品 / 仓库 / 单位 / 客户 / 供应商 …）。
 *
 * 只负责「拉选项」，绝不写回明细行——DsSelect 在 remote 模式下每敲一个字符
 * 都会 emit('search')，若在这里回填，用户尚未点选、按 Esc 取消后行里的商品
 * 就已被改写成第一条匹配项，属于会写错业务数据的缺陷。回填统一交给
 * onRefPicked（change 事件，只有真正选中才触发）。
 *
 * @param col 当前列（决定数据源）
 * @param kw  关键字
 * @param row 当前明细行（批次列据此按本行商品收窄）
 */
async function remoteSearch(col: string, kw: string, row?: any) {
  const ref = REF_MAP[col];
  if (!ref) return;
  refLoading[col] = true;
  try {
    const params: any = { limit: 20, sort: 'id', order: 'DESC' };
    const filter: Record<string, any> = {};
    const op: Record<string, any> = {};
    if (kw) {
      filter[ref.labelField] = `%${kw}%`;
      op[ref.labelField] = 'LIKE';
    }
    // 批次：只显示当前行所选商品的批次，避免跨商品选错批次（源端即为「选该商品的批次」）
    if (col === 'batch_id' && row?.goods_code) {
      filter.goods_code = row.goods_code;
    }
    if (Object.keys(filter).length) {
      params.filter = JSON.stringify(filter);
      if (Object.keys(op).length) params.op = JSON.stringify(op);
    }
    const res: any = await selectpage(ref.table, params);
    const list = res?.data?.rows || res?.rows || [];
    const opts = list.map((r: any) => ({ label: String(r[ref.labelField] ?? ''), value: r[ref.valueField] }));
    // 批次按行隔离缓存，避免不同商品的行互相覆盖批次候选项
    if (col === 'batch_id' && row) {
      rowBatchRows.set(row, list);
      rowBatchOptions.set(row, opts);
    }
    refRows[col] = list;
    refOptions[col] = opts;
  } catch {
    refRows[col] = [];
    refOptions[col] = [];
  } finally {
    refLoading[col] = false;
  }
}

/**
 * 引用列选中后的附加回填：选中商品时带出商品ID与常用单位，减少手工录入。
 *
 * @param col 当前列
 * @param val 选中的 value（等于 v-model 已写入的值）
 * @param row 明细行
 */
function onRefPicked(col: string, val: any, row: any) {
  // 批次列：选中批次后回填批次名称与生产日期/保质期/有效期，
  // 后端批次流转与批次明细子表需要这些字段（源端 Sales 351-373 行同口径）。
  if (col === 'batch_id') {
    const hit = (rowBatchRows.get(row) || refRows['batch_id'] || []).find((r: any) => String(r.id) === String(val));
    if (!hit) return;
    if (hit.batch_name != null) row.batch_name = hit.batch_name;
    if (hit.manufacture != null) row.manufacture = hit.manufacture;
    if (hit.guarantee != null) row.guarantee = hit.guarantee;
    if (hit.validity != null) row.validity = hit.validity;
    return;
  }
  if (col !== 'goods_code' && col !== 'goods_id') return;
  const ref = REF_MAP[col];
  if (!ref) return;
  const hit = (refRows[col] || []).find((r: any) => String(r[ref.valueField]) === String(val));
  if (!hit) return;
  // goods_code / goods_id 两列互为镜像，回填时保持一致，避免同一行两个编码对不上
  if (col === 'goods_code') {
    row.goods_code = hit.goods_code;
    if (hit.id != null) row.goods_id = hit.id;
    if (hit.unit_id != null) row.goods_unit = hit.unit_id;
  } else {
    row.goods_id = hit.id;
    row.goods_code = hit.goods_code ?? row.goods_code;
    if (hit.unit_id != null) row.goods_unit = hit.unit_id;
  }
}

/** 打开时就带上常用引用的默认选项，避免首次下拉空白 */
function warmRefs() {
  const cols = new Set<string>();
  for (const p of headFields.value) if (REF_MAP[p]) cols.add(p);
  for (const c of lineCols.value) if (REF_MAP[c.prop]) cols.add(c.prop);
  cols.forEach((c) => remoteSearch(c, ''));
}

/**
 * 消费「以销定购」草稿（源 purchaseby/setdata 的 session 交接）。
 *
 * special 的已销订购看板勾选行、填好本次采购数量/单价后，把明细写进
 * sessionStorage 再跳到这里；此处读取后直接进入新增编辑态并填好明细行，
 * 读完即删，避免刷新或二次进入重复带入。
 *
 * @returns 无；无草稿时不动任何表单状态
 */
function prefillFromDraft() {
  const key = `ds-doc-draft:${table.value}`;
  const raw = sessionStorage.getItem(key);
  if (!raw) return;
  sessionStorage.removeItem(key);
  try {
    const draft = JSON.parse(raw);
    // 兼容两种草稿：纯明细数组 / { lines, labels, head }
    const lines0 = Array.isArray(draft) ? draft : draft?.lines;
    const labels: Record<string, Record<string, string>> = Array.isArray(draft) ? {} : draft?.labels || {};
    const head0: Record<string, any> = Array.isArray(draft) ? {} : draft?.head || {};
    if (!Array.isArray(lines0) || !lines0.length) return;
    Object.keys(form).forEach((k) => delete form[k]);
    for (const p of headFields.value) form[p] = isTimeCol(p) ? '' : null;
    prefillKeys.value = [];
    // 表头回写：合并入库/出库时带上第一张订单的往来单位与仓库
    for (const [k, v] of Object.entries(head0)) {
      if (k in form) form[k] = v;
    }
    lines.value = lines0.map((r: any) => ({ ...emptyRow(), ...r }));
    // 引用列（商品/单位/仓库）补合成选项：草稿里的值可能不在首屏远程选项里，
    // 不补会显示为空下拉，用户看不到带入了什么
    for (const [col, map] of Object.entries(labels)) {
      if (!refOf(col)) continue;
      const list = refOptions[col] || (refOptions[col] = []);
      for (const [val, label] of Object.entries(map)) {
        if (list.some((o: any) => String(o.value) === String(val))) continue;
        list.push({ label: String(label || val), value: Number.isNaN(Number(val)) ? val : Number(val) });
      }
    }
    editing.value = true;
    toast.success(`已带入 ${lines.value.length} 行明细，请补充往来单位等信息后保存`);
  } catch {
    /* 草稿损坏时静默忽略，保持正常新增流程 */
  }
}

watch(
  () => route.params.table,
  async (v) => {
    if (!v) return;
    table.value = String(v);
    cfg.value = docConfig(table.value);
    editing.value = false;
    page.value = 1;
    loadList();
    // 换单据页后引用列集合会变，需重新预热；草稿/预取也可能属于新单据
    warmRefs();
    await prefillFromQuery();
    if (!editing.value) prefillFromDraft();
  },
);

onMounted(async () => {
  loadList();
  warmRefs();
  await prefillFromQuery();
  // 订货单预取未命中时，再看是否有「以销定购」草稿
  if (!editing.value) prefillFromDraft();
});
</script>

<style scoped>
.doc-page { padding: 12px; }
.toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.grow { flex: 1; }
.title { font-weight: 600; font-size: 15px; }
.line-bar { display: flex; align-items: center; gap: 8px; margin: 4px 0 8px; }
.line-title { font-weight: 600; margin-right: 8px; }
/* 表头栅格由全局 form.css 提供（字段多时自动铺开，窄屏自动单列） */
.foot { display: flex; gap: 24px; margin-top: 10px; font-size: 13px; color: var(--ds-text-2); }
.danger-link { color: var(--ds-danger); }
.attach-block { border-top: 1px dashed var(--ds-border); margin-top: 14px; padding-top: 10px; }
.attach-empty { color: var(--ds-text-3); font-size: 13px; padding: 8px 0; }
.attach-list { display: flex; flex-wrap: wrap; gap: 12px; }
.attach-item { width: 140px; border: 1px solid var(--ds-border); border-radius: 6px; overflow: hidden; background: var(--ds-bg-soft); }
.attach-img { width: 100%; height: 110px; object-fit: cover; display: block; }
.attach-meta { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px; font-size: 12px; color: var(--ds-text-3); }
</style>
