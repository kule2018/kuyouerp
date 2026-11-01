<template>
  <div class="pp-page">
    <div class="card-grid">
      <DsCard v-for="c in cards" :key="c.label" hoverable class="card">
        <div class="card-label">{{ c.label }}</div>
        <div class="card-value">{{ c.value }}</div>
      </DsCard>
    </div>

    <DsCard style="margin-top: 12px">
      <div class="block-title">最近生产成本明细</div>
      <DsTable :columns="cols" :data="rows" :loading="loading" striped>
        <template #code_type="{ row }">{{ row.code_type === '2' ? '委外加工单' : '加工单' }}</template>
        <template #outsourcing_free="{ row }">{{ fmt(row.outsourcing_free) }}</template>
        <template #hour_free="{ row }">{{ fmt(row.hour_free) }}</template>
        <template #wages_free="{ row }">{{ fmt(row.wages_free) }}</template>
        <template #production_free="{ row }">{{ fmt(row.production_free) }}</template>
        <template #material_free="{ row }">{{ fmt(row.material_free) }}</template>
        <template #cost_free="{ row }"><strong>{{ fmt(row.cost_free) }}</strong></template>
      </DsTable>
      <div class="more">
        <DsButton variant="text" size="sm" @click="goCost">查看全部生产成本 →</DsButton>
      </div>
    </DsCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { productionSummary, productionCost } from '../api/stats';

const router = useRouter();
const summary = ref<any>({});
const rows = ref<any[]>([]);
const loading = ref(false);

const cards = computed(() => [
  { label: '生产计划', value: Number(summary.value.plan_count || 0) },
  { label: '生产单', value: Number(summary.value.production_count || 0) },
  { label: '委外加工单', value: Number(summary.value.outsourcing_count || 0) },
  { label: '验收单', value: Number(summary.value.acceptance_count || 0) },
]);

const cols = [
  { title: '单据编号', key: 'purchase_code', width: '160px' },
  { title: '类型', key: 'code_type', width: '110px', slot: true },
  { title: '车间', key: 'workshop_name', width: '120px' },
  { title: '商品', key: 'goods_info', minWidth: '180px' },
  { title: '委外费', key: 'outsourcing_free', width: '110px', align: 'right' as const, slot: true },
  { title: '计时工资', key: 'hour_free', width: '110px', align: 'right' as const, slot: true },
  { title: '计件工资', key: 'wages_free', width: '110px', align: 'right' as const, slot: true },
  { title: '生产费用', key: 'production_free', width: '110px', align: 'right' as const, slot: true },
  { title: '退料金额', key: 'material_free', width: '110px', align: 'right' as const, slot: true },
  { title: '生产成本', key: 'cost_free', width: '130px', align: 'right' as const, slot: true },
];

function fmt(v: any) {
  if (v === '' || v === null || v === undefined) return '-';
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : String(v);
}

async function load() {
  try {
    const s: any = await productionSummary();
    summary.value = (s?.data || s) || {};
  } catch {
    summary.value = {};
  }
  loading.value = true;
  try {
    const r: any = await productionCost({ page: 1, limit: 10 });
    const d = r?.data || r || {};
    rows.value = d.rows || [];
  } catch {
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

function goCost() {
  router.push('/production-cost');
}

onMounted(load);
</script>

<style scoped>
.card-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.card { text-align: center; }
.card-label { font-size: 12px; color: var(--ds-text-3); }
.card-value { font-size: 20px; font-weight: bold; margin-top: 6px; }
.block-title { font-weight: 600; margin-bottom: 10px; }
.more { text-align: right; margin-top: 8px; }
</style>
