<template>
  <div class="crud" v-if="mod">
    <!-- 工具栏：第一行是检索条件（状态 / 时间区间 / 关键字），第二行是操作按钮 -->
    <div class="toolbar">
      <div class="toolbar-filters">
        <!-- 状态下拉筛选：源搜索栏 select，变更即下推后端 filter/op -->
        <DsSelect
          v-for="f in extras.filters || []"
          :key="f.prop"
          v-model="filterVals[f.prop]"
          :options="(f.options || []).map((o: any) => ({ label: o.label, value: o.value }))"
          :placeholder="f.label"
          clearable
          @change="load"
        />
        <!-- 时间区间筛选：源 laydate range，转时间戳后走后端 BETWEEN -->
        <DsDatePicker
          v-if="extras.dateRange"
          v-model="dateStart"
          type="datetime"
          :placeholder="(extras.dateRange.label || '') + '起'"
          @change="load"
        />
        <DsDatePicker
          v-if="extras.dateRange"
          v-model="dateEnd"
          type="datetime"
          :placeholder="(extras.dateRange.label || '') + '止'"
          @change="load"
        />
        <DsInput
          v-model="keyword"
          class="is-wide"
          placeholder="关键字搜索"
          clearable
          @clear="load"
          @keyup.enter="load"
        />
      </div>

      <div class="toolbar-actions">
        <DsButton variant="primary" @click="load">搜索</DsButton>
        <!-- 刷新：与源端 lay-event="refresh" 工具栏按钮一致 -->
        <DsButton @click="load">刷新</DsButton>
        <!-- 回收站：仅软删表展示，列出 deletetime 非空的数据 -->
        <DsButton v-if="recyclable" @click="openRecycle">回收站</DsButton>
        <!-- 导入：仅后端开放导入的基础资料展示 -->
        <DsButton v-if="importable" v-permission="`button:${table}:import`" @click="importVisible = true">导入</DsButton>
        <!-- 列设置：勾选控制列显隐，偏好按表持久化到 localStorage -->
        <DsPopover placement="bottom" :width="240" title="显示列">
          <template #reference>
            <DsButton>列设置</DsButton>
          </template>
          <div class="colset">
            <DsCheckbox
              v-for="c in displayCols"
              :key="c.prop"
              :model-value="isColVisible(c.prop)"
              size="sm"
              @change="(v: any) => toggleCol(c.prop, v)"
            >
              {{ c.label }}
            </DsCheckbox>
            <div class="colset-actions">
              <DsButton size="sm" variant="text" @click="resetCols">全部显示</DsButton>
            </div>
          </div>
        </DsPopover>
        <!-- 导出：把当前页按展示列导出为 Excel（xlsx 缺失时降级 CSV） -->
        <DsButton v-permission="`button:${table}:export`" @click="exportPage">导出</DsButton>
        <!-- 批量删除：与源端 lay-event="delAll" 一致 -->
        <DsButton v-if="selected.length" v-permission="`button:${table}:delete`" variant="ghost" class="danger-link" @click="removeAll">批量删除</DsButton>
        <!-- 表级扩展按钮：盘点导出等（源 lay-event 工具栏事件） -->
        <DsButton
          v-for="b in extras.toolbar || []"
          :key="b.action"
          :variant="btnVariant(b.type)"
          @click="runToolbarExtra(b.action)"
        >{{ b.label }}</DsButton>
        <span class="toolbar-spacer" />
        <DsButton variant="primary" v-permission="`button:${table}:add`" @click="openAdd">新增</DsButton>
      </div>
    </div>

    <!-- 列表 -->
    <DsTable
      :columns="tableColumns"
      :data="rows"
      :loading="loading"
      striped
      :row-key="rowKeyOf"
      :span-method="spanMethod"
      selection
      reserve-selection
      @selection-change="(v: any[]) => (selected = v)"
    >
      <template v-for="c in filteredCols" :key="c.prop" #[c.prop]="{ row }">
        <!-- 图片列：源 goods_image 渲染 50px 缩略图 -->
        <img v-if="c.image && row[c.prop]" :src="row[c.prop]" style="height: 50px" />
        <span v-else>{{ formatCell(row, c) }}</span>
      </template>
      <template #__op="{ row }">
        <DsButton variant="text" size="sm" v-permission="`button:${table}:edit`" @click="openEdit(row)">编辑</DsButton>
        <DsButton variant="text" size="sm" class="danger-link" v-permission="`button:${table}:delete`" @click="remove(row)">删除</DsButton>
        <!-- 行内扩展操作：审核 / 发货 / 生成销货单（源 user_order.js 行工具） -->
        <DsButton
          v-for="b in extras.row || []"
          :key="b.action"
          v-show="b.when(row)"
          :variant="btnVariant(b.type)"
          size="sm"
          @click="runRowExtra(b.action, row)"
        >{{ b.label }}</DsButton>
      </template>
    </DsTable>

    <!-- 分页 -->
    <div class="pager">
      <DsPagination
        layout="total, prev, pager, next"
        :current-page="page"
        :page-size="limit"
        :total="total"
        @change="onPage"
      />
    </div>

    <!-- 新增 / 编辑对话框（按列元数据自动生成表单） -->
    <DsModal v-model="dialogVisible" :title="editingId ? '编辑' : '新增'" :width="980">
      <div class="form-grid">
        <DsField v-for="c in formCols" :key="c.prop" :label="c.label" :required="isRequired(c.prop)">
          <DsSelect
            v-if="c.type === 'select' && c.enum"
            v-model="form[c.prop]"
            :options="(c.enum || []).map((o: any) => ({ label: o.label, value: o.value }))"
            placeholder="请选择"
            style="width: 100%"
          />
          <!-- 外键关联字段：远程字典下拉（供应商/客户/商品/仓库等） -->
          <DsSelect
            v-else-if="relationOf(c.prop)"
            v-model="form[c.prop]"
            :options="(relOptions[c.prop] || []).map((o: any) => ({ label: o.label + (String(o.value) !== o.label ? '（' + o.value + '）' : ''), value: o.value }))"
            filterable
            :placeholder="'搜索' + c.label"
            style="width: 100%"
          />
          <DsInput v-else-if="c.type === 'number'" v-model="form[c.prop]" type="number" />
          <DsInput v-else-if="c.type === 'textarea'" v-model="form[c.prop]" type="textarea" :rows="3" />
          <DsInput v-else v-model="form[c.prop]" />
        </DsField>
      </div>

      <!-- 商品扩展子表：多单位价格 / 序列号 / 分仓期初 / SKU / 批次期初。
           这些数组随 payload 提交，由后端 dynamic-crud.goodsAfterSave 写入对应子表（与源 Goods.php 一致）；
           此前通用 CRUD 不提交这些数组，导致新商品无定价 / SKU / 期初数据。 -->
      <div v-if="IS_GOODS" class="goods-children">
        <div v-for="cf in CHILD_FORMS" :key="cf.key" class="gc-block">
          <div class="gc-head">
            <span class="gc-title">{{ cf.title }}</span>
            <DsButton size="sm" variant="text" @click="addChild(cf)">+ 添加</DsButton>
          </div>
          <table class="gc-table" v-if="goodChildren[cf.key].length">
            <thead>
              <tr>
                <th v-for="f in cf.fields" :key="f.prop">{{ f.label }}</th>
                <th class="gc-op">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in goodChildren[cf.key]" :key="i">
                <td v-for="f in cf.fields" :key="f.prop">
                  <DsSelect
                    v-if="f.type === 'rel'"
                    v-model="row[f.prop]"
                    :options="childRelOptions[childRelKey(cf.key, f.prop)] || []"
                    filterable
                    :placeholder="'选择' + f.label"
                    style="width: 100%"
                  />
                  <DsSelect
                    v-else-if="f.type === 'enum'"
                    v-model="row[f.prop]"
                    :options="(f.enum || []).map((o: any) => ({ label: o.label, value: o.value }))"
                    style="width: 100%"
                  />
                  <DsInput v-else-if="f.type === 'num'" v-model="row[f.prop]" type="number" style="width: 92px" />
                  <DsInput v-else v-model="row[f.prop]" style="width: 120px" />
                </td>
                <td class="gc-op">
                  <DsButton variant="text" size="sm" class="danger-link" @click="removeChild(cf.key, i)">删</DsButton>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="gc-empty">未添加</div>
        </div>
      </div>

      <template #footer>
        <DsButton @click="dialogVisible = false">取消</DsButton>
        <DsButton variant="primary" @click="save">保存</DsButton>
      </template>
    </DsModal>

    <!-- 导入对话框：上传 Excel 后按 editstatus 决定「编号已存在」的处理方式 -->
    <DsModal v-model="importVisible" title="导入" :width="520">
      <div class="form-grid">
        <DsField label="选择文件">
          <input type="file" accept=".xls,.xlsx,.csv" @change="onFilePicked" />
        </DsField>
        <DsField label="编号已存在">
          <div class="radio-line">
            <DsRadio v-model="editstatus" :value="1">更新已有数据</DsRadio>
            <DsRadio v-model="editstatus" :value="0">中止导入并提示</DsRadio>
          </div>
        </DsField>
        <DsField v-if="table === 'goods'" label="辅助属性">
          <DsInput v-model="skuText" placeholder="属性 ID，多个用逗号分隔（可留空）" />
        </DsField>
      </div>
      <template #footer>
        <DsButton @click="importVisible = false">取消</DsButton>
        <DsButton variant="primary" :loading="importing" @click="doImport">开始导入</DsButton>
      </template>
    </DsModal>

    <!-- 回收站对话框：还原 / 彻底删除 -->
    <DsModal v-model="recycleVisible" title="回收站" :width="900">
      <DsTable :columns="recycleColumns" :data="recycleRows" :loading="recycleLoading" striped selection :height="460">
        <template #__op="{ row }">
          <DsButton variant="text" size="sm" @click="restore(row)">还原</DsButton>
          <DsButton variant="text" size="sm" class="danger-link" @click="destroy(row)">彻底删除</DsButton>
        </template>
      </DsTable>
      <div class="pager">
        <DsPagination
          layout="total, prev, pager, next"
          :current-page="recyclePage"
          :page-size="limit"
          :total="recycleTotal"
          @change="onRecyclePage"
        />
      </div>
    </DsModal>

    <!-- 发货司机选择：源 diver_type=1 时弹层选择配送司机（user_order.js deliver 分支） -->
    <DsModal v-model="driverVisible" title="选择配送司机" :width="420">
      <DsSelect
        v-model="deliverForm.diver_id"
        :options="drivers.map((d: any) => ({ label: d.name + (d.phone ? '（' + d.phone + '）' : ''), value: d.id }))"
        filterable
        placeholder="请选择配送司机"
        style="width: 100%"
      />
      <template #footer>
        <DsButton @click="driverVisible = false">取消</DsButton>
        <DsButton variant="primary" @click="confirmDeliver">确定</DsButton>
      </template>
    </DsModal>

    <!-- 盘点数据：源 inventory.js 行操作 exchange 弹层（盘盈单 / 盘亏单） -->
    <DsModal v-model="checkVisible" title="盘点数据" :width="460">
      <div v-if="checkOptions.length" class="check-list">
        <DsButton
          v-for="o in checkOptions"
          :key="o.status"
          :variant="Number(o.status) === 1 ? 'primary' : 'danger'"
          block
          @click="openCheckDoc(o)"
        >{{ o.title }}</DsButton>
      </div>
      <DsEmpty v-else title="无盈亏明细" description="该盘点单没有盘盈 / 盘亏数量，无需生成盘单单据" />
      <template #footer>
        <DsButton @click="checkVisible = false">关闭</DsButton>
      </template>
    </DsModal>
  </div>

  <DsEmpty v-else title="模块不存在或未配置" />
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from '@/components/ds/toast';
import { confirm } from '@/components/ds/useConfirm';
import { findModule, type ModuleMeta, type ColumnMeta } from '../config/modules';
import { relationOf } from '../config/relations';
import { relationOptions } from '../api/relation';
import * as api from '../api/dynamic';
import { canImport, uploadFile, runImport } from '../api/import';
import { hasRecycle, recycleList, recycleRestore, recycleDestroy } from '../api/recycle';
import { extrasOf } from '../config/table-extras';
import { requiredOf } from '../config/required-fields';
import { userOrderExamine, userOrderDeliver, inventoryExport, inventoryCheck } from '../api/misc';

/** 当前表名（路由 /crud/:table） */
const route = useRoute();
const router = useRouter();
const toast = useToast();
const table = computed(() => String(route.params.table || ''));
/** 表对应的模块元数据（标题/主键/列） */
const mod = computed<ModuleMeta | undefined>(() => findModule(table.value));
/** 当前表的扩展配置（工具栏/行内按钮、展示列、筛选项、合并字段） */
const extras = computed(() => extrasOf(table.value));

/** 表格显示列（隐藏 textarea 长文本，避免撑宽） */
const tableCols = computed<ColumnMeta[]>(
  () => (mod.value?.columns || []).filter((c) => c.type !== 'textarea'),
);
/** 列表展示列（兼容元数据列与表级覆盖列） */
interface ListCol {
  prop: string;
  label: string;
  width?: number;
  enumMap?: Record<string, string>;
  image?: boolean;
  enum?: { value: string; label: string }[] | null;
}
/** 列表展示列：有表级覆盖配置（如用户订单商品级展开列）时用之，否则取元数据列 */
const displayCols = computed<ListCol[]>(
  () => (extras.value.listCols?.length ? extras.value.listCols : (tableCols.value as ListCol[])),
);
/** 操作列宽度：有行内扩展按钮时加宽，避免换行 */
const opColWidth = computed(() => (extras.value.row?.length ? 230 : 150));

/* ---------------- 列显隐（偏好按表持久化） ---------------- */

/** 当前表被隐藏的列名集合 */
const hiddenCols = ref<Set<string>>(new Set());

/** 列显隐偏好的存储键（按表隔离，切表互不干扰） */
const colKey = computed(() => `ds-cols:${table.value}`);

/**
 * 读取当前表的列显隐偏好
 * @returns 无
 */
function loadColPref() {
  try {
    const raw = localStorage.getItem(colKey.value);
    const arr = raw ? JSON.parse(raw) : [];
    hiddenCols.value = new Set(Array.isArray(arr) ? arr : []);
  } catch {
    // 存储不可用或内容损坏时回退到「全部显示」
    hiddenCols.value = new Set();
  }
}

/** 写回列显隐偏好 */
function saveColPref() {
  try {
    localStorage.setItem(colKey.value, JSON.stringify([...hiddenCols.value]));
  } catch {
    /* 隐私模式下存储可能抛错，忽略即可 */
  }
}

/**
 * 该列当前是否显示
 * @param prop 列名
 * @returns 未在隐藏集合中即显示
 */
function isColVisible(prop: string): boolean {
  return !hiddenCols.value.has(prop);
}

/**
 * 切换列显隐
 * @param prop 列名
 * @param v DsCheckbox 回传值（独立模式为布尔）
 * @returns 无
 */
function toggleCol(prop: string, v: any) {
  const on = v === true || (Array.isArray(v) ? v.includes(prop) : Boolean(v));
  const next = new Set(hiddenCols.value);
  if (on) next.delete(prop);
  else next.add(prop);
  hiddenCols.value = next;
  saveColPref();
}

/** 恢复全部列显示 */
function resetCols() {
  hiddenCols.value = new Set();
  saveColPref();
}

/** 应用列显隐后的展示列（列表渲染与导出共用） */
const filteredCols = computed<ListCol[]>(() => displayCols.value.filter((c) => isColVisible(c.prop)));

/* ---------------- 导出当前页 ---------------- */

/**
 * 导出当前页数据
 *
 * 按展示列（含枚举中文、时间格式化）生成二维数组：
 * xlsx 可动态加载时写 xlsx，失败则降级为带 BOM 的 CSV，保证中文不乱码。
 *
 * @returns 无
 */
async function exportPage() {
  if (!rows.value.length) {
    toast.warning('当前页没有数据可导出');
    return;
  }
  const cols = filteredCols.value;
  const name = mod.value?.title || table.value;
  const aoa: any[][] = [cols.map((c) => c.label), ...rows.value.map((r) => cols.map((c) => formatCell(r, c)))];
  try {
    const XLSX: any = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${name}.xlsx`);
    toast.success(`已导出 ${rows.value.length} 条`);
  } catch {
    const csv = aoa
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${rows.value.length} 条（CSV）`);
  }
}

/* ---------------- 必填校验 ---------------- */

/** 当前表是否必填（源表单 data-rule="required"） */
function isRequired(prop: string): boolean {
  return requiredOf(table.value).includes(prop);
}

/**
 * 提交前必填校验
 * 只校验源系统标记为 required 的字段，空值按中文列名提示。
 * @returns 全部通过返回 true
 */
function validate(): boolean {
  const req = requiredOf(table.value);
  if (!req.length) return true;
  const missing = req.filter((p) => {
    const v = form.value[p];
    return v === null || v === undefined || String(v).trim() === '';
  });
  if (!missing.length) return true;
  const labelOf = (p: string) => formCols.value.find((c) => c.prop === p)?.label || p;
  toast.warning(`请填写：${missing.map(labelOf).join('、')}`);
  return false;
}
/**
 * 行唯一键：合并表（用户订单）一行一个商品、多行共享订单 id，
 * 用「订单 id + 商品行关键字段」组合保证唯一，避免 row-key 冲突。
 */
const rowKeyOf = (row: any) =>
  extras.value.mergeBy
    ? `${row.id}|${row.goods_code ?? ''}|${row.goods_name ?? ''}|${row.price ?? ''}|${row.number ?? ''}`
    : String(row.id);
/** 表单列（可编辑字段） */
const formCols = computed<ColumnMeta[]>(
  () => (mod.value?.columns || []).filter((c) => c.editable),
);

/** 主表列配置：序号 + 展示列（全部走插槽，支持图片/枚举/时间格式化）+ 操作列 */
const tableColumns = computed(() => [
  { title: '#', key: '__idx', width: '55px', formatter: (_v: any, _r: any, i: number) => i + 1 },
  ...filteredCols.value.map((c) => ({
    title: c.label,
    key: c.prop,
    width: c.width ? c.width + 'px' : undefined,
    minWidth: '110px',
    slot: true,
  })),
  { title: '操作', key: '__op', width: opColWidth.value + 'px', fixed: 'right' as const, slot: true },
]);

/** 回收站列配置：序号 + 前 6 列 + 操作列 */
const recycleColumns = computed(() => [
  { title: '#', key: '__idx', width: '55px', formatter: (_v: any, _r: any, i: number) => i + 1 },
  ...tableCols.value.slice(0, 6).map((c) => ({
    title: c.label,
    key: c.prop,
    minWidth: '120px',
    slot: true,
  })),
  { title: '操作', key: '__op', width: '150px', fixed: 'right' as const, slot: true },
]);

const rows = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(15);
const keyword = ref('');
const loading = ref(false);
/** 表级筛选项当前值（源搜索栏 select，如订单状态） */
const filterVals = reactive<Record<string, any>>({});
/** 时间区间筛选当前值（源 laydate range，起止两个 datetime） */
const dateStart = ref('');
const dateEnd = ref('');

/**
 * 预设视图固定筛选条件。
 * 整体思路：源系统把 kuyou_enclosure 按 type 拆成「采购附件(1)」「销售附件(2)」两个独立菜单页，
 * 迁移后共用同一张表与同一个通用页，用路由 query（?type=2）表达固定筛选，
 * 保证两边看到的数据范围与原系统一致。
 *
 * @returns 形如 `{ type: '2' }` 的固定筛选键值对；无 query 时返回空对象
 */
function presetFilter(): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(route.query)) {
    // 只接受标量 query（数组/对象忽略），空串视为未设置
    if (typeof v === 'string' && v !== '') out[k] = v;
  }
  return out;
}

/** 加载列表（对接 /kuyou/:table/index，返回 {total, rows}） */
/**
 * 列表请求序号：快速翻页 / 连续搜索时，先发的慢响应后到会覆盖新结果，
 * 用自增序号丢弃过期响应，保证视图里留下的永远是最后一次请求的数据。
 */
let loadSeq = 0;

async function load() {
  if (!mod.value) return;
  const my = ++loadSeq;
  loading.value = true;
  try {
    const params: any = {
      offset: (page.value - 1) * limit.value,
      limit: limit.value,
      search: keyword.value || undefined,
      sort: mod.value.pk,
      order: 'desc',
    };
    // 表级筛选项：状态下拉 =，时间区间 BETWEEN（转秒级时间戳与库内 bigint 比较）
    const flt: Record<string, any> = {};
    const op: Record<string, string> = {};
    // 预设视图固定筛选：路由 query 声明的列（如 销售附件 = kuyou_enclosure + type=2），
    // 对应源端 Enclosure(type=2) / Enclosuresale 两个独立菜单页
    const preset = presetFilter();
    for (const k of Object.keys(preset)) {
      flt[k] = preset[k];
      op[k] = '=';
    }
    for (const f of extras.value.filters || []) {
      const v = filterVals[f.prop];
      if (v !== undefined && v !== null && v !== '') {
        flt[f.prop] = v;
        op[f.prop] = '=';
      }
    }
    const dr = extras.value.dateRange;
    if (dr && dateStart.value && dateEnd.value) {
      flt[dr.prop] = [toTs(dateStart.value), toTs(dateEnd.value)];
      op[dr.prop] = 'BETWEEN';
    }
    if (Object.keys(flt).length) {
      params.filter = JSON.stringify(flt);
      params.op = JSON.stringify(op);
    }
    const res: any = await api.list(table.value, params);
    // 过期响应直接丢弃，避免覆盖后发起的请求结果
    if (my !== loadSeq) return;
    total.value = res.total || 0;
    rows.value = res.rows || [];
  } catch (e: any) {
    // 错误提示已由 request 拦截器统一 toast，这里只兜住 rejection，
    // 避免从模板事件里裸调用 load() 时产生未捕获的 Promise 拒绝
    if (my === loadSeq) toast.error(e?.message || '列表加载失败');
  } finally {
    if (my === loadSeq) loading.value = false;
  }
}

/** 日期字符串 → 秒级时间戳（供 BETWEEN 与 bigint 时间列比较） */
function toTs(s: string): number {
  return Math.floor(new Date(String(s).replace(' ', 'T')).getTime() / 1000);
}

/** 翻页 */
function onPage(p: number) {
  page.value = p;
  load();
}

/** 单元格展示：枚举转中文、空值占位、时间格式化（兼容表级 enumMap 覆盖列） */
function formatCell(row: any, c: { prop: string; enum?: any; enumMap?: Record<string, string> }): string {
  let v = row[c.prop];
  if (v === null || v === undefined || v === '') return '—';
  // 表级枚举映射（源 templet，如订单状态 0=待审核）
  if (c.enumMap) {
    const hit = c.enumMap[String(v)];
    if (hit) return hit;
  }
  if (c.enum && c.enum.length) {
    const hit = c.enum.find((o) => String(o.value) === String(v));
    if (hit) return hit.label;
  }
  // 时间戳列（createtime/updatetime/deletetime）转为可读时间
  if (/time$/.test(c.prop) && /^\d{10}$/.test(String(v))) {
    const d = new Date(Number(v) * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return String(v);
}

/**
 * 按钮类型 → DsButton variant（源 el-button type 映射）。
 * DsButton 只提供 primary/default/ghost/danger/text 五档，
 * 源里的 success 归到 primary，避免落到 default 变成灰按钮失去强调。
 */
function btnVariant(type?: string): 'primary' | 'default' | 'ghost' | 'danger' | 'text' {
  if (type === 'primary' || type === 'success') return 'primary';
  if (type === 'danger') return 'danger';
  return 'default';
}

/* ---------------- 新增 / 编辑 ---------------- */
const dialogVisible = ref(false);
const form = ref<Record<string, any>>({});
const editingId = ref<number | string | null>(null);

/** 外键关联下拉选项缓存：prop -> [{ value, label }] */
const relOptions = ref<Record<string, { value: any; label: string }[]>>({});

/**
 * 预载当前表单涉及的外键关联选项。
 * 整体思路：遍历表单可编辑列，命中 relations 映射的字段按「字典表 + 取值列 + 名称列」去重，
 * 全量拉取选项后回填到引用同一字典表的各外键列，供下拉本地过滤与初始值回显。
 */
async function preloadRelations() {
  const seen = new Set<string>();
  const tasks: Promise<void>[] = [];
  for (const c of formCols.value) {
    const rel = relationOf(c.prop);
    if (!rel) continue;
    const key = `${rel.table}|${rel.value}|${rel.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tasks.push(
      relationOptions(rel.table, rel.value, rel.label)
        .then((res: any) => {
          for (const cc of formCols.value) {
            const r2 = relationOf(cc.prop);
            if (r2 && r2.table === rel.table && r2.value === rel.value && r2.label === rel.label) {
              relOptions.value[cc.prop] = res.options || [];
            }
          }
        })
        .catch(() => {}),
    );
  }
  await Promise.all(tasks);
}

/** 打开新增：按列初始化默认值 */
async function openAdd() {
  if (!mod.value) return;
  await preloadRelations();
  const f: Record<string, any> = {};
  formCols.value.forEach((c) => {
    if (c.type === 'number') f[c.prop] = 0;
    else if (c.type === 'select' && c.enum && c.enum.length) f[c.prop] = c.enum[0].value;
    else f[c.prop] = '';
  });
  form.value = f;
  editingId.value = null;
  if (IS_GOODS.value) {
    resetGoodChildren();
    preloadChildRels();
  }
  dialogVisible.value = true;
}

/** 打开编辑：拉取单条回显 */
async function openEdit(row: any) {
  if (!mod.value) return;
  await preloadRelations();
  const res: any = await api.detail(table.value, row[mod.value.pk]);
  form.value = res.data || {};
  editingId.value = row[mod.value.pk];
  if (IS_GOODS.value) {
    preloadChildRels();
    if (form.value.goods_code) await loadGoodChildren(form.value.goods_code);
  }
  dialogVisible.value = true;
}

/**
 * 保存（新增 / 编辑）。
 *
 * 提交体只取表单列覆盖的字段，不整体回写 form：
 * 编辑态的 form 来自后端 detail 的 `SELECT *` 全行，含 id / createtime /
 * updatetime / admin_id 等系统列，后端 edit 只做「列存在性」过滤而不排除
 * 时间戳，原样提交会把 updatetime 覆盖成编辑前的旧值（修改时间永不更新）。
 */
async function save() {
  if (!mod.value) return;
  // 必填校验：源表单 data-rule="required" 的字段不允许为空
  if (!validate()) return;
  const payload: Record<string, any> = {};
  for (const c of formCols.value) payload[c.prop] = form.value[c.prop];
  if (IS_GOODS.value) {
    for (const cf of CHILD_FORMS) {
      if (goodChildren[cf.key].length) payload[cf.key] = goodChildren[cf.key];
    }
  }
  if (editingId.value !== null) {
    payload[mod.value.pk] = editingId.value;
    const res: any = await api.edit(table.value, payload);
    toast.success(res.msg || '保存成功');
  } else {
    const res: any = await api.add(table.value, payload);
    toast.success(res.msg || '新增成功');
  }
  dialogVisible.value = false;
  load();
}

/* ---------------- 商品扩展子表（多单位价格 / 序列号 / 期初 / SKU / 批次） ---------------- */

/** 仅商品表（kuyou_goods）编辑时展示扩展子表编辑区 */
const IS_GOODS = computed(() => table.value === 'kuyou_goods');

interface ChildField {
  prop: string;
  label: string;
  type: 'rel' | 'enum' | 'num' | 'txt';
  rel?: { table: string; value: string; label: string };
  enum?: { value: string; label: string }[];
}
interface ChildForm {
  key: string;
  table: string;
  title: string;
  fields: ChildField[];
}
/**
 * 子表编辑配置：
 * - key：保存 payload 的键（短名，传给后端 goodsAfterSave）
 * - table：编辑时回拉已有行用的全表名
 */
const CHILD_FORMS: ChildForm[] = [
  {
    key: 'goods_price', table: 'kuyou_goods_price', title: '多单位价格',
    fields: [
      { prop: 'unit', label: '单位', type: 'rel', rel: { table: 'kuyou_unit', value: 'id', label: 'name' } },
      { prop: 'market_sell_price', label: '零售价', type: 'num' },
      { prop: 'wholesale_price', label: '批发价', type: 'num' },
      { prop: 'vip_price', label: '会员价', type: 'num' },
      { prop: 'discount', label: '折扣', type: 'num' },
      { prop: 'discount2', label: '折扣2', type: 'num' },
      { prop: 'purchase', label: '采购价', type: 'num' },
      { prop: 'is_default', label: '默认', type: 'enum', enum: [{ value: '1', label: '是' }, { value: '0', label: '否' }] },
    ],
  },
  {
    key: 'goods_serial', table: 'kuyou_goods_serial', title: '序列号（期初）',
    fields: [
      { prop: 'serial', label: '序列号', type: 'txt' },
      { prop: 'stores_id', label: '仓库', type: 'rel', rel: { table: 'kuyou_stores', value: 'id', label: 'name' } },
      { prop: 'attribute_id', label: '属性ID', type: 'num' },
      { prop: 'remark', label: '备注', type: 'txt' },
    ],
  },
  {
    key: 'stores_data', table: 'kuyou_goods_stock', title: '分仓期初库存',
    fields: [
      { prop: 'stores_id', label: '仓库', type: 'rel', rel: { table: 'kuyou_stores', value: 'id', label: 'name' } },
      { prop: 'stock', label: '数量', type: 'num' },
      { prop: 'unit_cost', label: '单位成本', type: 'num' },
      { prop: 'price', label: '金额', type: 'num' },
    ],
  },
  {
    key: 'attr_price', table: 'kuyou_goods_attr', title: '辅助属性 / SKU',
    fields: [
      { prop: 'attr_ids', label: '属性组合(如 1&2)', type: 'txt' },
      { prop: 'attr_code', label: '属性编码', type: 'txt' },
    ],
  },
  {
    key: 'goods_batch', table: 'kuyou_goods_batch', title: '批次（期初）',
    fields: [
      { prop: 'batch_name', label: '批次号', type: 'txt' },
      { prop: 'stores_id', label: '仓库', type: 'rel', rel: { table: 'kuyou_stores', value: 'id', label: 'name' } },
      { prop: 'stock', label: '数量', type: 'num' },
      { prop: 'unit_cost', label: '单位成本', type: 'num' },
      { prop: 'price', label: '金额', type: 'num' },
      { prop: 'manufacture', label: '生产日期', type: 'txt' },
      { prop: 'guarantee', label: '保质期(天)', type: 'num' },
    ],
  },
];

/** 商品子表数据（保存时随 payload 一并提交；后端 goodsAfterSave 据此写子表） */
const goodChildren = reactive<Record<string, any[]>>({
  goods_price: [], stores_data: [], attr_price: [], goods_serial: [], goods_batch: [],
});
/** 子表关联下拉选项缓存（unit / stores） */
const childRelOptions = reactive<Record<string, { value: any; label: string }[]>>({});

/** 子表关联下拉缓存键 */
function childRelKey(t: string, prop: string): string {
  return `${t}|${prop}`;
}
/** 预载子表关联下拉（单位 / 仓库） */
async function ensureChildRel(rel: { table: string; value: string; label: string }, t: string, prop: string) {
  const k = childRelKey(t, prop);
  if (childRelOptions[k]) return;
  try {
    const res: any = await relationOptions(rel.table, rel.value, rel.label);
    childRelOptions[k] = (res.options || []).map((o: any) => ({ value: o.value, label: String(o.label) }));
  } catch {
    childRelOptions[k] = [];
  }
}
/** 预载全部子表关联下拉 */
function preloadChildRels() {
  for (const cf of CHILD_FORMS) {
    for (const f of cf.fields) {
      if (f.type === 'rel' && f.rel) void ensureChildRel(f.rel, cf.key, f.prop);
    }
  }
}
/** 清空子表数据 */
function resetGoodChildren() {
  for (const k of Object.keys(goodChildren)) goodChildren[k] = [];
}
/** 子表新增一行（按字段类型给默认值） */
function addChild(cf: ChildForm) {
  const row: Record<string, any> = {};
  for (const f of cf.fields) {
    if (f.type === 'num') row[f.prop] = 0;
    else if (f.type === 'enum') row[f.prop] = f.enum && f.enum.length ? f.enum[0].value : '';
    else row[f.prop] = '';
  }
  goodChildren[cf.key].push(row);
}
/** 子表删除一行 */
function removeChild(key: string, i: number) {
  goodChildren[key].splice(i, 1);
}
/** 编辑时拉取已有子表行回填 */
async function loadGoodChildren(goodsCode: string) {
  resetGoodChildren();
  for (const cf of CHILD_FORMS) {
    try {
      const res: any = await api.list(cf.table, {
        limit: 300, sort: 'id', order: 'asc',
        filter: JSON.stringify({ goods_code: goodsCode }),
        op: JSON.stringify({ goods_code: '=' }),
      });
      goodChildren[cf.key] = (res.rows || []).map((r: any) => {
        const row: Record<string, any> = {};
        for (const f of cf.fields) row[f.prop] = r[f.prop] ?? (f.type === 'num' ? 0 : '');
        return row;
      });
    } catch {
      /* 子表无数据或接口异常，忽略 */
    }
  }
}

/**
 * 删除单行。
 * 删除后必须清空勾选集：DsTable 开了 reserve-selection，被删行若仍留在
 * selected 里，随后的「批量删除/批量审核」会对已不存在的 id 重复发请求。
 */
async function remove(row: any) {
  if (!mod.value) return;
  if (!(await confirm('确认删除该条记录？', '提示'))) return;
  await api.del(table.value, String(row[mod.value.pk]));
  toast.success('删除成功');
  selected.value = [];
  load();
}

/** 勾选行（批量删除用，对应源端 lay-event="delAll"） */
const selected = ref<any[]>([]);

/** 批量删除：一次提交全部主键，后端 :table/del 支持逗号分隔 ids */
async function removeAll() {
  if (!mod.value || !selected.value.length) return;
  // 合并表（用户订单）多行共享同一订单 id，去重后再提交
  const ids = [...new Set(selected.value.map((r: any) => r[mod.value!.pk]))];
  if (!(await confirm(`确认删除选中的 ${ids.length} 条记录？`, '提示'))) return;
  await api.del(table.value, ids.join(','));
  toast.success(`删除成功 ${ids.length} 条`);
  selected.value = [];
  load();
}

/* ---------------- 导入 ---------------- */
/** 当前表是否开放导入 / 回收站 */
const importable = computed(() => canImport(table.value));
const recyclable = computed(() => hasRecycle(table.value));

const importVisible = ref(false);
const importing = ref(false);
const importFile = ref<File | null>(null);
/** 源默认 1：编号已存在则更新；0 表示中止导入 */
const editstatus = ref<0 | 1>(1);
/** 商品导入的辅助属性 ID（逗号分隔） */
const skuText = ref('');

/** 记住用户选中的文件，真正上传在点击「开始导入」时触发 */
function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement;
  importFile.value = input.files && input.files.length ? input.files[0] : null;
}

/**
 * 执行导入：先上传到服务端拿到路径，再调用对应实体的 import 接口。
 * 完成后提示「新增 N 条 / 更新 M 条」，与源前端展示保持一致。
 */
async function doImport() {
  if (!importFile.value) {
    toast.warning('请先选择要导入的文件');
    return;
  }
  importing.value = true;
  try {
    const path = await uploadFile(importFile.value);
    const skulist = skuText.value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '')
      .map((s) => Number(s))
      .filter((n) => !Number.isNaN(n));
    const res: any = await runImport(table.value, path, editstatus.value, skulist);
    const data = res?.data || res || {};
    toast.success(`导入成功：新增 ${data.add ?? 0} 条，更新 ${data.update ?? 0} 条`);
    importVisible.value = false;
    load();
  } finally {
    importing.value = false;
  }
}

/* ---------------- 回收站 ---------------- */
const recycleVisible = ref(false);
const recycleRows = ref<any[]>([]);
const recycleTotal = ref(0);
const recyclePage = ref(1);
const recycleLoading = ref(false);

/** 打开回收站并加载首屏 */
async function openRecycle() {
  recycleVisible.value = true;
  recyclePage.value = 1;
  await loadRecycle();
}

/** 加载已软删数据 */
async function loadRecycle() {
  recycleLoading.value = true;
  try {
    const res: any = await recycleList(table.value, {
      page: recyclePage.value,
      limit: limit.value,
      sort: mod.value?.pk || 'id',
      order: 'desc',
    });
    recycleTotal.value = res.total || 0;
    recycleRows.value = res.rows || [];
  } finally {
    recycleLoading.value = false;
  }
}

/** 回收站翻页 */
function onRecyclePage(p: number) {
  recyclePage.value = p;
  loadRecycle();
}

/** 还原单条：deletetime 置回 NULL */
async function restore(row: any) {
  await recycleRestore(table.value, [row[mod.value?.pk || 'id']]);
  toast.success('已还原');
  await loadRecycle();
  load();
}

/** 彻底删除单条：物理删除 */
async function destroy(row: any) {
  if (!(await confirm('彻底删除后不可恢复，确认继续？', '警告'))) return;
  await recycleDestroy(table.value, [row[mod.value?.pk || 'id']]);
  toast.success('已彻底删除');
  await loadRecycle();
}

/* ---------------- 表级扩展：工具栏 ---------------- */

/**
 * 工具栏扩展按钮分发（源 lay-event 工具栏事件）。
 * @param action inventory-export=导出盘点表（后端返回 xlsx 文件流，前端触发下载）
 */
async function runToolbarExtra(action: string) {
  if (action !== 'inventory-export') return;
  try {
    const res: any = await inventoryExport();
    // 响应拦截器已剥掉业务层，此处 res 即文件 Blob
    const blob = res instanceof Blob ? res : new Blob([res]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    a.href = url;
    a.download = `盘点${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('导出成功');
  } catch {
    toast.error('导出失败');
  }
}

/* ---------------- 表级扩展：行内操作（用户订单） ---------------- */

/**
 * 行内扩展按钮分发（源 user_order.js 行工具 table.on('tool')）。
 * @param action user-order-examine=审核 / user-order-deliver=发货 / user-order-sales=生成销货单
 * @param row    当前行数据
 */
async function runRowExtra(action: string, row: any) {
  if (action === 'user-order-examine') {
    // 审核：确认后翻 status 0→2（后端仅未审核单可审）
    if (!(await confirm('你确定要审核此订单吗?', '提示'))) return;
    await userOrderExamine(String(row.id));
    toast.success('审核成功');
    load();
  } else if (action === 'user-order-deliver') {
    // 发货：确认后翻 status 2→3；专业配送（diver_type=1）需先选配送司机
    if (!(await confirm('你确定要为此订单发货吗?', '提示'))) return;
    if (Number(row.diver_type) === 1) {
      deliverForm.value = { ids: String(row.id), diver_id: '' };
      driverVisible.value = true;
      if (!drivers.value.length) {
        const res: any = await api.list('kuyou_driver', { limit: 200, sort: 'id', order: 'asc' });
        drivers.value = res.rows || [];
      }
    } else {
      await userOrderDeliver(String(row.id));
      toast.success('发货成功');
      load();
    }
  } else if (action === 'user-order-sales') {
    // 生成销货单：跳转销货单新增页并带上订货单 id，由 document.vue 预取填充
    // （源 Fast.api.open("kuyou/goods_sales/add?order_id="+data.id)）
    router.push({ name: 'document', params: { table: 'kuyou_goods_sales' }, query: { order_id: String(row.id) } });
  } else if (action === 'inventory-check') {
    // 生成盘单单据：先查该盘点单的盈亏方向，再让用户选盘盈单 / 盘亏单
    // （源 inventory.js 行操作 exchange → kuyou/Warehousing/checkInventory）
    try {
      const res: any = await inventoryCheck(String(row.purchase_code), 1);
      // 后端返回数组；请求层可能再包一层 data，这里两种形态都兼容
      const list = Array.isArray(res) ? res : res?.data || [];
      checkOptions.value = list;
      checkVisible.value = true;
    } catch {
      toast.error('查询盘点盈亏失败');
    }
  }
}

/* ---------------- 表级扩展：盘点生成盘单单据（源 inventory.js exchange） ---------------- */

/** 盘点数据弹层是否可见 */
const checkVisible = ref(false);
/** 可生成的盘单单据（盘盈单 status=1 / 盘亏单 status=2） */
const checkOptions = ref<any[]>([]);

/**
 * 打开盘盈 / 盘亏单新增页。
 * 整体思路：与源端一致——status=1 盘盈走「其他入库单」(kuyou_warehousing)，
 * status=2 盘亏走「其他出库单」(kuyou_warehouse)，并把盘点单号作为来源单带过去。
 *
 * @param opt 盘点联动项 `{ type, purchase_code, status, title }`
 */
function openCheckDoc(opt: any) {
  const target = Number(opt.status) === 1 ? 'kuyou_warehousing' : 'kuyou_warehouse';
  checkVisible.value = false;
  router.push({
    name: 'document',
    params: { table: target },
    query: { source_code: String(opt.purchase_code), source_type: String(opt.type ?? 1) },
  });
}

/** 发货司机弹层状态（diver_type=1 的专业配送，源 deliver 分支的司机下拉） */
const driverVisible = ref(false);
const drivers = ref<any[]>([]);
const deliverForm = ref<{ ids: string; diver_id: any }>({ ids: '', diver_id: '' });

/** 确认发货：带司机 id 提交（send_type=1） */
async function confirmDeliver() {
  if (deliverForm.value.diver_id === '' || deliverForm.value.diver_id === null || deliverForm.value.diver_id === undefined) {
    toast.warning('请选择配送司机');
    return;
  }
  await userOrderDeliver(deliverForm.value.ids, { send_type: 1, diver_id: deliverForm.value.diver_id });
  toast.success('发货成功');
  driverVisible.value = false;
  load();
}

/* ---------------- 列表合并（源 layui tableMerge） ---------------- */

/**
 * 合并计划预计算。
 * 整体思路：用户订单一行一个商品，同一订单的多行由后端富化保证相邻，
 * 按 mergeBy 连续相同值分组；组内只有取值完全一致的列（订单级字段）才合并，
 * 商品级字段（商品/单价/数量）保持独立——与源端 merge:['order_num'] 的视觉效果一致。
 * 结果为 Map<行下标, Map<列prop, rowspan>>，rowspan=0 表示该格被合并吸收。
 */
const mergePlan = computed(() => {
  const key = extras.value.mergeBy;
  const plan = new Map<number, Map<string, number>>();
  if (!key || !rows.value.length) return plan;
  // 合并候选列：全部展示列 + 操作列（__op，源端 operate 列同样按订单合并）
  const cols = [...displayCols.value.map((c) => c.prop), '__op'];
  const norm = (v: any) => (v === null || v === undefined ? '' : String(v));
  let i = 0;
  while (i < rows.value.length) {
    let j = i + 1;
    while (j < rows.value.length && norm(rows.value[j][key]) === norm(rows.value[i][key])) j++;
    const len = j - i;
    if (len > 1) {
      for (const p of cols) {
        const first = norm(rows.value[i][p]);
        let stable = true;
        for (let k = i + 1; k < j; k++) {
          if (norm(rows.value[k][p]) !== first) {
            stable = false;
            break;
          }
        }
        if (stable) {
          for (let k = i; k < j; k++) {
            if (!plan.has(k)) plan.set(k, new Map());
            plan.get(k)!.set(p, k === i ? len : 0);
          }
        }
      }
    }
    i = j;
  }
  return plan;
});

/** 合并回调（DsTable span-method）：仅对配置了 mergeBy 且命中合并计划的单元格生效 */
function spanMethod({ column, rowIndex }: any) {
  const p = column.property;
  if (!p) return { rowspan: 1, colspan: 1 };
  const v = mergePlan.value.get(rowIndex)?.get(p);
  if (v === undefined) return { rowspan: 1, colspan: 1 };
  return v === 0 ? { rowspan: 0, colspan: 0 } : { rowspan: v, colspan: 1 };
}

/**
 * 表切换 / 预设视图切换时重新加载。
 *
 * 两个源必须写在同一个 watcher 里：route.params 与 route.query 在同一次导航中
 * 一起变化，拆成两个 watcher 会让换表这一件事触发两遍回调，发出两笔完全相同的
 * 列表请求（第二个 watcher 还会因为 route.query 每次都是新对象引用而额外命中）。
 *
 * 只有真正换表才重置筛选条件与列显隐偏好；采购附件 ↔ 销售附件这类「同表不同
 * query」的预设视图切换只重置页码，避免把用户已填的检索条件清掉。
 */
watch(
  [table, () => JSON.stringify(route.query)],
  (_now, prev) => {
    const prevTable = prev?.[0];
    page.value = 1;
    if (prevTable !== undefined && prevTable !== table.value) {
      Object.keys(filterVals).forEach((k) => delete filterVals[k]);
      dateStart.value = '';
      dateEnd.value = '';
      loadColPref();
      preloadRelations();
    }
    load();
  },
);
onMounted(() => {
  loadColPref();
  load();
  preloadRelations();
});
</script>

<style scoped>
.crud {
  background: var(--ds-bg-elevated);
  padding: 16px;
  border-radius: var(--ds-radius-md);
  border: 1px solid var(--ds-border);
}
/* 工具栏：检索条件一行（等宽栅格）+ 操作按钮一行 */
.toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}
.toolbar-filters {
  display: grid;
  /* 每列 200~260px，超出自动换行并左对齐，避免单个搜索框被拉得过宽 */
  grid-template-columns: repeat(auto-fill, minmax(200px, 260px));
  gap: 10px 12px;
  justify-content: start;
}
.toolbar-filters > .is-wide {
  grid-column: span 2;
}
.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.toolbar-spacer { flex: 1 1 auto; }
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}
.danger-link { color: var(--ds-danger); }
/* 盘点数据弹层：盘盈 / 盘亏单按钮纵向排列，块级撑满便于点击 */
.check-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
/* 列设置浮层：纵向排布，超长时可滚动 */
.colset {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow: auto;
}
.colset-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
  border-top: 1px solid var(--ds-border);
  margin-top: 2px;
}
/* 商品扩展子表编辑区 */
.goods-children {
  margin-top: 12px;
  border-top: 1px dashed var(--ds-border);
  padding-top: 10px;
  max-height: 48vh;
  overflow: auto;
}
.gc-block { margin-bottom: 14px; }
.gc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.gc-title { font-weight: 600; color: var(--ds-text); }
.gc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.gc-table th, .gc-table td {
  border: 1px solid var(--ds-border);
  padding: 4px 6px;
  text-align: left;
}
.gc-table th { background: var(--ds-bg); }
.gc-op { width: 48px; text-align: center; }
.gc-empty { color: var(--ds-text-muted); font-size: 12px; padding: 4px 0; }
</style>
