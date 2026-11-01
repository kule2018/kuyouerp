<template>
  <div>
    <h2>库存盘点过账</h2>
    <DsCard title="新建盘点单（带入系统库存）">
      <div class="form">
        <div class="item">
          <label>仓库</label>
          <DsSelect v-model="form.stores_id" :options="storeOptions" filterable placeholder="请选择" />
        </div>
        <div class="item">
          <label>备注</label>
          <DsInput v-model="form.remark" placeholder="可选" />
        </div>
      </div>

      <div class="items">
        <div class="row head">
          <span>商品</span><span>系统库存</span><span>实盘库存</span><span>盘盈/盘亏</span><span></span>
        </div>
        <div v-for="(it, i) in items" :key="i" class="row">
          <DsSelect v-model="it.goods_id" :options="goodsOptions" filterable placeholder="选择商品" @update:modelValue="fillSystem(it)" />
          <span>{{ it.system }}</span>
          <DsInput v-model="it.actual_stock" type="number" />
          <span :class="plClass(it)">{{ it.actual_stock && it.system!=='' ? (Number(it.actual_stock)-Number(it.system)).toFixed(2) : '' }}</span>
          <DsButton size="sm" variant="default" @click="items.splice(i,1)">删除</DsButton>
        </div>
        <DsButton size="sm" variant="default" @click="addRow">+ 添加商品</DsButton>
      </div>

      <div style="margin-top:12px">
        <DsButton variant="primary" :loading="submitting" @click="submit">保存盘点单</DsButton>
        <DsAlert v-if="msg" :type="msgType" :description="msg" style="margin-top:8px" />
      </div>
    </DsCard>

    <DsCard title="盘点单列表" style="margin-top:16px">
      <DsTable :columns="cols" :data="rows" striped :loading="loading" emptyText="暂无盘点单">
        <template #action="{ row }">
          <DsButton v-if="row.examine_status!=='1'" size="sm" variant="primary" @click="post(row)">过账</DsButton>
          <DsTag v-else type="success">已过账</DsTag>
        </template>
      </DsTable>
    </DsCard>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue';
import request from '../utils/request';
import DsCard from '@/components/ds/DsCard.vue';
import DsButton from '@/components/ds/DsButton.vue';
import DsSelect from '@/components/ds/DsSelect.vue';
import DsInput from '@/components/ds/DsInput.vue';
import DsTable from '@/components/ds/DsTable.vue';
import DsAlert from '@/components/ds/DsAlert.vue';
import DsTag from '@/components/ds/DsTag.vue';

const form = reactive({ stores_id: '', remark: '' });
const items = reactive<any[]>([]);
const submitting = ref(false);
const loading = ref(false);
const msg = ref('');
const msgType = ref<'success'|'info'|'danger'>('info');

const goods = ref<any[]>([]);
const stores = ref<any[]>([]);
const rows = ref<any[]>([]);

const goodsOptions = computed(() => goods.value.map((g) => ({ label: `${g.goods_name} (${g.goods_code})`, value: g.id })));
const storeOptions = computed(() => stores.value.map((s) => ({ label: s.name, value: s.id })));

const cols = [
  { key: 'purchase_code', title: '单号' },
  { key: 'stores_id', title: '仓库ID' },
  { key: 'item_count', title: '明细数' },
  { key: 'examine_status', title: '状态', formatter: (_v:any, r:any)=> r.examine_status==='1'?'已审核':'未审核' },
  { key: 'createtime', title: '创建时间' },
  { key: 'action', title: '操作' },
];

function addRow() { items.push({ goods_id: '', system: '', actual_stock: '' }); }
function fillSystem(it: any) {
  const g = goods.value.find((x) => x.id === it.goods_id);
  it.system = g ? g.inventory : '';
}
function plClass(it: any) {
  const pl = Number(it.actual_stock) - Number(it.system);
  return pl > 0 ? 'profit' : pl < 0 ? 'loss' : '';
}

async function loadOptions() {
  const g: any = await request.get('/goods/index', { params: { limit: 500 } });
  goods.value = g.data?.rows || [];
  const s: any = await request.get('/stores/index', { params: { limit: 100 } });
  stores.value = s.data?.rows || [];
}
async function loadList() {
  loading.value = true;
  const r: any = await request.get('/stocktake/index', { params: { limit: 100 } });
  rows.value = r.data?.rows || [];
  loading.value = false;
}
async function submit() {
  if (!form.stores_id) { msg.value = '请选择仓库'; msgType.value = 'danger'; return; }
  const valid = items.filter((i) => i.goods_id && i.actual_stock !== '');
  if (!valid.length) { msg.value = '请至少添加一个有实盘数量的商品'; msgType.value = 'danger'; return; }
  submitting.value = true; msg.value = '';
  const body = { stores_id: form.stores_id, remark: form.remark, items: valid.map((i) => ({ goods_id: i.goods_id, actual_stock: Number(i.actual_stock) })) };
  const r: any = await request.post('/stocktake/add', body).catch((e) => ({ data: { code: 0, msg: e.message } }));
  submitting.value = false;
  const d = r.data || {};
  if (d.code === 1) { msg.value = '盘点单已保存，可在列表过账'; msgType.value = 'success'; items.splice(0); loadList(); }
  else { msg.value = d.msg || '保存失败'; msgType.value = 'danger'; }
}
async function post(row: any) {
  const r: any = await request.post('/stocktake/post', { id: row.id }).catch((e) => ({ data: { code: 0, msg: e.message } }));
  const d = r.data || {};
  if (d.code === 1) { msg.value = `盘点单 ${row.purchase_code} 已过账，库存已校正`; msgType.value = 'success'; loadList(); }
  else { msg.value = d.msg || '过账失败'; msgType.value = 'danger'; }
}
onMounted(() => { loadOptions(); loadList(); });
</script>

<style scoped>
.form { display: flex; gap: 14px; align-items: flex-end; margin-bottom: 14px; }
.item { display: flex; flex-direction: column; gap: 4px; min-width: 200px; }
.item label { font-size: 13px; color: var(--ds-text-3); }
.items { margin-top: 8px; }
.row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 0.8fr; gap: 10px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--ds-border, #eee); }
.row.head { font-size: 12px; color: var(--ds-text-3); font-weight: 600; }
.profit { color: #1890ff; }
.loss { color: #f5222d; }
</style>
