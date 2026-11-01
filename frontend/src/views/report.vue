<template>
  <div class="report-page">
    <!-- 筛选栏：完全由后端报表定义驱动 -->
    <DsCard>
      <template #title>
        <div class="toolbar">
          <span class="title">{{ def?.title || key }}</span>
        </div>
      </template>
      <template #extra>
        <DsButton @click="load">查询</DsButton>
        <DsButton @click="reset">重置</DsButton>
        <DsButton variant="ghost" @click="exportCsv">导出 CSV</DsButton>
      </template>

      <div class="filter-bar">
        <DsField v-for="f in def?.filters || []" :key="f.name" :label="f.label">
          <!-- 字典下拉（供应商/客户/仓库等，远程搜索） -->
          <DsSelect
            v-if="f.type === 'select'"
            v-model="params[f.name]"
            :options="refOptions[f.name] || []"
            remote
            filterable
            clearable
            :placeholder="f.label"
            @search="(kw: string) => loadRef(f, kw)"
          />
          <DsDatePicker
            v-else-if="f.type === 'date'"
            v-model="params[f.name]"
            type="date"
            :placeholder="f.label"
          />
          <DsInput
            v-else-if="f.type === 'number'"
            v-model="params[f.name]"
            type="number"
          />
          <DsInput v-else v-model="params[f.name]" :placeholder="f.label" clearable />
        </DsField>
      </div>
    </DsCard>

    <!-- 结果表格 -->
    <DsCard style="margin-top: 10px">
      <DsTable
        :columns="tableCols"
        :data="rows"
        :loading="loading"
        striped
        :height="560"
        show-summary
        :summary-data="summaryData"
      />

      <DsPagination
        style="margin-top: 12px"
        layout="total, sizes, prev, pager, next"
        :total="total"
        v-model:currentPage="page"
        v-model:pageSize="limit"
        :page-sizes="[20, 50, 100, 200]"
        @change="load"
      />
    </DsCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@/components/ds/toast';
import { listReports, runReport } from '../api/report';
import { selectpage } from '../api/dynamic';

/**
 * 通用报表页
 * - 左侧菜单按业务分组选择报表；页面按后端报表定义渲染筛选表单与列
 * - 数值列在页脚由后端返回的 totals 汇总（避免浮点误差累积）
 * - 支持导出 CSV（列 + 当前结果集）
 */

const route = useRoute();
const toast = useToast();
const key = ref(String(route.params.key || ''));
const def = ref<any>(null);
const reports = ref<any[]>([]);
const rows = ref<any[]>([]);
const columns = ref<string[]>([]);
const totals = ref<Record<string, number>>({});
const total = ref(0);
const page = ref(1);
const limit = ref(50);
const loading = ref(false);
const params = reactive<Record<string, any>>({});

/** 字典（ref 型筛选器）的可选项缓存 */
const refOptions = reactive<Record<string, { label: string; value: any }[]>>({});

/** 表格列：序号列 + 后端返回的动态列 */
const tableCols = computed(() => [
  { title: '#', key: '__idx', width: '60px', formatter: (_v: any, _r: any, i: number) => i + 1 },
  ...columns.value.map((c) => ({
    title: c,
    key: c,
    width: c.length > 6 ? '180px' : '130px',
    formatter: (_v: any, row: any) => display(row, c),
  })),
]);

/** 页脚合计数据（列名 -> 展示值） */
const summaryData = computed(() => {
  const m: Record<string, any> = {};
  for (const [k, v] of Object.entries(totals.value)) {
    m[k] = v === undefined ? '—' : String(Number((v as any).toFixed ? (v as any).toFixed(2) : v));
  }
  return m;
});

/** 加载报表定义列表 */
async function loadDefs() {
  const res: any = await listReports();
  reports.value = (res?.data as any[]) || [];
  def.value = reports.value.find((r: any) => r.key === key.value) || null;
  if (!def.value) toast.warning('未找到报表定义: ' + key.value);
}

/** 加载字典数据（远端搜索） */
async function loadRef(f: any, kw: string) {
  if (!f?.ref) return;
  const { table, labelField } = f.ref;
  const q: any = { limit: 30, sort: 'id', order: 'DESC' };
  if (kw) {
    q.filter = JSON.stringify({ [labelField]: `%${kw}%` });
    q.op = JSON.stringify({ [labelField]: 'LIKE' });
  }
  try {
    const res: any = await selectpage(table, q);
    const list = res?.rows || res?.data?.rows || [];
    refOptions[f.name] = list.map((r: any) => ({ label: String(r[labelField] ?? ''), value: r.id }));
  } catch {
    refOptions[f.name] = [];
  }
}

/** 时间列展示：秒级时间戳 -> 日期时间 */
function display(row: any, col: string) {
  const v = row[col];
  if (v === null || v === undefined || v === '') return '';
  if (/^\d{10,}$/.test(String(v)) && /日期|时间|生于/.test(col)) {
    const d = new Date(Number(v) * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  return String(v);
}

/** 执行报表查询 */
async function load() {
  if (!def.value) return;
  loading.value = true;
  try {
    // 清理空值，避免后端把空串当有效条件
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== '' && v !== null && v !== undefined) clean[k] = v;
    }
    const res: any = await runReport(key.value, clean, (page.value - 1) * limit.value, limit.value);
    const d = res?.data ?? res;
    rows.value = d?.rows || [];
    columns.value = d?.columns || [];
    totals.value = d?.totals || {};
    total.value = Number(d?.total || 0);
  } catch (e: any) {
    toast.error(e?.message || '查询失败');
  } finally {
    loading.value = false;
  }
}

/** 重置筛选条件并回到第一页 */
function reset() {
  Object.keys(params).forEach((k) => delete params[k]);
  page.value = 1;
  load();
}

/** 导出当前结果集为 CSV（带 BOM，Excel 打开不乱码） */
function exportCsv() {
  if (!rows.value.length) return toast.warning('暂无数据可导出');
  const header = columns.value.join(',');
  const body = rows.value
    .map((r) => columns.value.map((c) => `"${String(display(r, c)).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${def.value?.title || key.value}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// 路由切换报表 key 时重载
watch(
  () => route.params.key,
  async (v) => {
    if (!v) return;
    key.value = String(v);
    def.value = reports.value.find((r: any) => r.key === key.value) || null;
    Object.keys(params).forEach((k) => delete params[k]);
    page.value = 1;
    await load();
  },
);

onMounted(async () => {
  await loadDefs();
  // 字典型筛选器预热，避免下拉首次为空
  for (const f of def.value?.filters || []) if (f.ref) await loadRef(f, '');
  await load();
});
</script>

<style scoped>
.report-page { padding: 12px; }
.toolbar { display: flex; align-items: center; gap: 8px; }
.title { font-weight: 600; font-size: 15px; }
</style>
