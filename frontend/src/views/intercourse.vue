<template>
  <div class="intercourse">
    <DsCard>
      <div class="filter-bar">
        <DsField label="类型">
          <DsSelect v-model="typeSel" :options="typeOptions" multiple clearable placeholder="全部" @change="load" />
        </DsField>
        <DsField label="关键字">
          <DsInput v-model="keyword" placeholder="编码/名称" @keyup.enter="load" />
        </DsField>
        <div class="filter-actions">
          <DsButton variant="primary" @click="load">查询</DsButton>
        </div>
      </div>
    </DsCard>

    <DsCard style="margin-top: 12px">
      <DsTable :columns="cols" :data="rows" striped />
      <div class="sum">合计：应收 {{ money(totalReceive) }} ｜ 应付 {{ money(totalGive) }}</div>
    </DsCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { intercourse } from '../api/stats';

const rows = ref<any[]>([]);
const typeSel = ref<number[]>([]);
const keyword = ref('');

const typeOptions = [
  { value: 1, label: '客户（应收）' },
  { value: 2, label: '供应商（应付）' },
];

const cols = [
  { title: '编码', key: 'code', width: '160px' },
  { title: '名称', key: 'name' },
  { title: '类型', key: 'type', width: '120px', formatter: (v: any, row: any) => (row.type === 1 ? '客户' : '供应商') },
  { title: '应收金额', key: 'receive', width: '160px', align: 'right', formatter: (v: any, row: any) => (row.receive !== undefined ? money(row.receive) : '-') },
  { title: '应付金额', key: 'give', width: '160px', align: 'right', formatter: (v: any, row: any) => (row.give !== undefined ? money(row.give) : '-') },
];

async function load() {
  const res: any = await intercourse(typeSel.value, keyword.value);
  rows.value = (res?.rows || res?.data?.rows || []);
}
const totalReceive = computed(() => rows.value.filter((r) => r.type === 1).reduce((a, r) => a + Number(r.receive || 0), 0));
const totalGive = computed(() => rows.value.filter((r) => r.type === 2).reduce((a, r) => a + Number(r.give || 0), 0));
function money(v: any) {
  return Number(v || 0).toFixed(2);
}
onMounted(load);
</script>

<style scoped>
.sum { margin-top: 12px; text-align: right; font-weight: bold; }
</style>
