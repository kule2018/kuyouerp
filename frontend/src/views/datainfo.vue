<template>
  <div class="datainfo">
    <!-- 本月汇总卡片 -->
    <div class="card-grid">
      <DsCard v-for="c in cards" :key="c.label" hoverable class="card">
        <div class="card-label">{{ c.label }}</div>
        <div class="card-value">{{ c.value }}</div>
      </DsCard>
    </div>

    <!-- 趋势 / 统计 -->
    <DsCard style="margin-top: 12px">
      <DsTabs v-model="tab" :items="tabItems" @change="load" />

      <!-- 趋势柱状图（轻量 SVG，无第三方依赖） -->
      <div v-if="tab === 1 || tab === 2" class="chart">
        <svg :viewBox="`0 0 ${chartW} ${chartH}`" class="svg">
          <line :x1="pad" :y1="baseY" :x2="chartW - pad" :y2="baseY" stroke="var(--ds-border)" />
          <g v-for="(d, i) in trendData.data" :key="i">
            <rect
              :x="pad + i * barStep + barStep / 2 - barW / 2"
              :y="baseY - (d / maxV) * plotH"
              :width="barW"
              :height="(d / maxV) * plotH"
              fill="var(--ds-brand)"
            />
            <text :x="pad + i * barStep + barStep / 2" :y="baseY + 14" font-size="9" text-anchor="middle" fill="var(--ds-text-3)">
              {{ trendData.column[i]?.slice(5) }}
            </text>
            <text :x="pad + i * barStep + barStep / 2" :y="baseY - (d / maxV) * plotH - 4" font-size="9" text-anchor="middle" fill="var(--ds-text-2)">
              {{ d }}
            </text>
          </g>
        </svg>
        <div class="legend">{{ trendData.legend }}（近 7 日）</div>
      </div>

      <!-- 库存 / 账户 表格 -->
      <DsTable v-if="tab !== 5" :columns="statCols" :data="statRows" striped />

      <!-- 库存预警面板（源 datainfo/stockworing） -->
      <div v-else>
        <div class="warn-bar">
          <span class="warn-count">预警商品数：<b>{{ warnTotal }}</b></span>
          <span class="warn-tip">以下商品库存数量已低于预警下限，请及时补货</span>
        </div>
        <DsTable style="margin-top: 8px" :columns="warnTableCols" :data="warnRows" striped :height="520" />
      </div>
    </DsCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { datainfo, datainfoSummary } from '../api/stats';
import { runReport } from '../api/report';

const tab = ref<number>(1);
const trendData = ref<any>({ legend: '', column: [], data: [] });
const statRows = ref<any[]>([]);
const summary = ref<any>({});

/** 页签配置（值对应后端 datainfo 类型） */
const tabItems = [
  { label: '购货趋势', value: 1 },
  { label: '销货趋势', value: 2 },
  { label: '库存统计', value: 3 },
  { label: '账户统计', value: 4 },
  { label: '库存预警', value: 5 },
];

/** 汇总卡片 */
const cards = computed(() => [
  { label: '本月购货数量', value: Number(summary.value.purchase_num || 0).toFixed(2) },
  { label: '本月购货金额', value: Number(summary.value.purchase_mon || 0).toFixed(2) },
  { label: '本月销货数量', value: Number(summary.value.sales_num || 0).toFixed(2) },
  { label: '本月销货金额', value: Number(summary.value.sales_mon || 0).toFixed(2) },
  { label: '库存总数', value: Number(summary.value.stock_num || 0).toFixed(2) },
]);

/** 库存 / 账户统计表列 */
const statCols = [
  { title: '名称', key: 'name' },
  { title: '数值', key: 'value', align: 'right' as const, formatter: (v: any) => Number(v || 0).toFixed(2) },
];

// SVG 图表参数
const chartW = 680, chartH = 220, pad = 30, baseY = 185, plotH = 150;
const barStep = computed(() => (chartW - pad * 2) / Math.max(trendData.value.column.length, 1));
const barW = 26;
const maxV = computed(() => Math.max(1, ...trendData.value.data));

/** 库存预警数据（复用后端 stock_warning 报表） */
const warnRows = ref<any[]>([]);
const warnCols = ref<string[]>([]);
const warnTotal = ref(0);
const warnTableCols = computed(() =>
  warnCols.value.map((c) => ({
    title: c,
    key: c,
    width: c.length > 6 ? '180px' : '130px',
    formatter: (v: any) => (v === null || v === undefined || v === '' ? '' : String(v)),
  })),
);

/** 按当前页签加载趋势或统计数据 */
async function load() {
  const t = Number(tab.value);
  if (t === 1 || t === 2) {
    const res: any = await datainfo(t);
    trendData.value = res?.data || res || { legend: '', column: [], data: [] };
  } else if (t === 5) {
    const res: any = await runReport('stock_warning', {}, 0, 50);
    const d = res?.data || res || {};
    warnRows.value = d?.rows || [];
    warnCols.value = d?.columns || [];
    warnTotal.value = Number(d?.total || 0);
  } else {
    const res: any = await datainfo(t);
    statRows.value = res?.data?.data || res?.data || [];
  }
}

/** 加载本月汇总 */
async function loadSummary() {
  const res: any = await datainfoSummary();
  summary.value = (res?.data || res) || {};
}

onMounted(async () => {
  await loadSummary();
  await load();
});
</script>

<style scoped>
.card-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
.card { text-align: center; }
.card-label { font-size: 12px; color: var(--ds-text-3); }
.card-value { font-size: 20px; font-weight: bold; margin-top: 6px; }
.chart { text-align: center; }
.svg { width: 100%; max-width: 680px; }
.legend { margin-top: 8px; color: var(--ds-text-2); font-size: 13px; }
.warn-bar { display: flex; align-items: baseline; gap: 12px; margin-bottom: 4px; }
.warn-count { font-size: 14px; }
.warn-count b { color: var(--ds-danger); font-size: 16px; }
.warn-tip { color: var(--ds-text-3); font-size: 12px; }
</style>
