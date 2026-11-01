<template>
  <div class="pc-page">
    <DsCard>
      <DsTabs v-model="tab" :items="tabItems" @change="onTabChange" />

      <div class="filter-bar">
        <DsField label="车间">
          <DsSelect v-model="workshopId" :options="workshopOptions" placeholder="全部" clearable />
        </DsField>
        <DsField label="关键字">
          <DsInput v-model="keyword" placeholder="单据编号 / 商品" />
        </DsField>
        <div class="filter-actions">
          <DsButton variant="primary" @click="load">查询</DsButton>
          <DsButton @click="reset">重置</DsButton>
        </div>
      </div>
    </DsCard>

    <DsCard style="margin-top: 12px">
      <DsTable :columns="cols" :data="rows" :loading="loading" striped>
        <template #code_type="{ row }">{{ row.code_type === '2' ? '委外加工单' : '加工单' }}</template>
        <template #outsourcing_free="{ row }">{{ fmt(row.outsourcing_free) }}</template>
        <template #hour_free="{ row }">{{ fmt(row.hour_free) }}</template>
        <template #wages_free="{ row }">{{ fmt(row.wages_free) }}</template>
        <template #production_free="{ row }">{{ fmt(row.production_free) }}</template>
        <template #material_free="{ row }">{{ fmt(row.material_free) }}</template>
        <template #cost_free="{ row }"><strong>{{ fmt(row.cost_free) }}</strong></template>
      </DsTable>

      <DsPagination
        style="margin-top: 12px"
        layout="total, prev, pager, next"
        :total="total"
        v-model:currentPage="page"
        :page-size="limit"
        @change="load"
      />
    </DsCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { productionCost } from '../api/stats';
import { list } from '../api/dynamic';

const tab = ref('all');
const tabItems = [
  { label: '全部', value: 'all' },
  { label: '加工单', value: '1' },
  { label: '委外加工单', value: '2' },
];

const rows = ref<any[]>([]);
const loading = ref(false);
const workshopId = ref<any>('');
const workshopOptions = ref<{ label: string; value: any }[]>([]);
const keyword = ref('');
const page = ref(1);
const limit = ref(20);
const total = ref(0);

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
  loading.value = true;
  try {
    const params: Record<string, any> = { page: page.value, limit: limit.value };
    if (tab.value !== 'all') params.code_type = tab.value;
    if (workshopId.value) params.workshop_id = workshopId.value;
    if (keyword.value) params.keyword = keyword.value;
    const res: any = await productionCost(params);
    const data = res?.data || res || {};
    rows.value = data.rows || [];
    total.value = Number(data.total || 0);
  } catch (e: any) {
    rows.value = [];
    console.error(e);
  } finally {
    loading.value = false;
  }
}

function reset() {
  workshopId.value = '';
  keyword.value = '';
  tab.value = 'all';
  page.value = 1;
  load();
}

function onTabChange() {
  page.value = 1;
  load();
}

async function loadWorkshops() {
  try {
    const res: any = await list('kuyou_workshop', { limit: 200 });
    const data = res?.data || res || {};
    workshopOptions.value = (data.rows || []).map((w: any) => ({ label: w.name, value: w.id }));
  } catch {
    workshopOptions.value = [];
  }
}

onMounted(() => {
  loadWorkshops();
  load();
});
</script>

<style scoped>
.pc-page .filter-bar {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
}
.filter-actions {
  display: flex;
  gap: 8px;
}
</style>
