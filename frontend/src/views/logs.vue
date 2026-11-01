<template>
  <div>
    <h2>操作日志 / 数据导出</h2>
    <DsCard title="操作日志">
      <DsTable :columns="cols" :data="rows" striped :loading="loading" emptyText="暂无日志" />
    </DsCard>

    <DsCard title="数据导出（CSV）" style="margin-top:16px">
      <div class="exports">
        <DsButton v-for="e in exports" :key="e.table" size="sm" variant="default" @click="doExport(e.table)">{{ e.label }}</DsButton>
      </div>
    </DsCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import request from '../utils/request';
import DsCard from '@/components/ds/DsCard.vue';
import DsButton from '@/components/ds/DsButton.vue';
import DsTable from '@/components/ds/DsTable.vue';

const rows = ref<any[]>([]);
const loading = ref(false);
const exports = [
  { table: 'goods', label: '导出商品' },
  { table: 'customers', label: '导出客户' },
  { table: 'suppliers', label: '导出供应商' },
  { table: 'stocktake', label: '导出盘点单' },
];

const cols = [
  { key: 'id', title: 'ID' },
  { key: 'module', title: '模块' },
  { key: 'action', title: '操作' },
  { key: 'content', title: '内容' },
  { key: 'createtime', title: '时间' },
];

async function load() {
  loading.value = true;
  const r: any = await request.get('/operate_log/index', { params: { limit: 200 } });
  rows.value = r.data?.rows || [];
  loading.value = false;
}
async function doExport(table: string) {
  const r: any = await request.get('/data/export', { params: { table, limit: 1000 } });
  const d = r.data;
  if (d?.code !== 1) { return; }
  const blob = new Blob([d.csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${table}_export.csv`; a.click();
  URL.revokeObjectURL(url);
}
onMounted(load);
</script>

<style scoped>
.exports { display: flex; flex-wrap: wrap; gap: 10px; }
</style>
