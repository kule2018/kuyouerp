<template>
  <div>
    <h2>收付款核销</h2>
    <DsCard>
      <div class="bar">
        <DsButton :variant="type==='collection'?'primary':'default'" size="sm" @click="type='collection'">收款核销</DsButton>
        <DsButton :variant="type==='payment'?'primary':'default'" size="sm" @click="type='payment'">付款核销</DsButton>
      </div>

      <div class="form">
        <div class="item">
          <label>{{ type==='collection' ? '客户' : '供应商' }}</label>
          <DsSelect v-model="form.party" :options="partyOptions" filterable placeholder="请选择" />
        </div>
        <div class="item">
          <label>结算账户</label>
          <DsSelect v-model="form.account" :options="accountOptions" filterable placeholder="请选择" />
        </div>
        <div class="item">
          <label>核销金额</label>
          <DsInput v-model="form.money" type="number" placeholder="0.00" />
        </div>
        <div class="item">
          <label>备注</label>
          <DsInput v-model="form.remark" placeholder="可选" />
        </div>
        <DsButton variant="primary" :loading="submitting" @click="submit">{{ type==='collection' ? '确认收款' : '确认付款' }}</DsButton>
      </div>
      <DsAlert v-if="msg" :type="msgType" :description="msg" />
    </DsCard>

    <DsCard title="近期单据" style="margin-top:16px">
      <DsTable :columns="cols" :data="rows" striped :loading="loading" emptyText="暂无单据" />
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

const type = ref<'collection'|'payment'>('collection');
const submitting = ref(false);
const loading = ref(false);
const msg = ref('');
const msgType = ref<'success'|'info'|'danger'>('info');

const form = reactive({ party: '', account: 1, money: '', remark: '' });
const customers = ref<any[]>([]);
const suppliers = ref<any[]>([]);
const accounts = ref<any[]>([]);
const rows = ref<any[]>([]);

const partyOptions = computed(() =>
  (type.value === 'collection' ? customers.value : suppliers.value).map((x) => ({
    label: x.customer_name || x.supplyer_name, value: x.id,
  })),
);
const accountOptions = computed(() => accounts.value.map((x) => ({ label: x.account_name, value: x.id })));

const cols = computed(() => (type.value === 'collection'
  ? [ { key: 'purchase_code', title: '单号' }, { key: 'customers_id', title: '客户ID' }, { key: 'money', title: '金额' }, { key: 'examine_status', title: '状态', formatter: (_v:any, r:any)=> r.examine_status==='1'?'已审核':'未审核' } ]
  : [ { key: 'purchase_code', title: '单号' }, { key: 'customers_id', title: '供应商ID' }, { key: 'money', title: '金额' }, { key: 'examine_status', title: '状态', formatter: (_v:any, r:any)=> r.examine_status==='1'?'已审核':'未审核' } ]));

async function loadOptions() {
  const c: any = await request.get('/customers/index', { params: { limit: 300 } });
  customers.value = c.data?.rows || [];
  const s: any = await request.get('/suppliers/index', { params: { limit: 300 } });
  suppliers.value = s.data?.rows || [];
  const a: any = await request.get('/accounts/index', { params: { limit: 100 } });
  accounts.value = a.data?.rows || [];
}
async function loadList() {
  loading.value = true;
  const t = type.value;
  const r: any = await request.get(`/${t}/index`, { params: { limit: 50 } });
  rows.value = r.data?.rows || [];
  loading.value = false;
}
async function submit() {
  if (!form.party || !form.money || Number(form.money) <= 0) { msg.value = '请选择往来单位并填写金额'; msgType.value = 'danger'; return; }
  submitting.value = true; msg.value = '';
  const body = { [type.value === 'collection' ? 'customers_id' : 'suppliers_id']: form.party, accounts_id: form.account, money: Number(form.money), remark: form.remark };
  const r: any = await request.post(`/${type.value}/add`, body).catch((e) => ({ data: { code: 0, msg: e.message } }));
  submitting.value = false;
  const d = r.data || {};
  if (d.code === 1) { msg.value = (type.value === 'collection' ? '收款' : '付款') + '核销成功，已冲减往来余额'; msgType.value = 'success'; form.money = ''; loadList(); }
  else { msg.value = d.msg || '操作失败'; msgType.value = 'danger'; }
}
onMounted(() => { loadOptions(); loadList(); });
</script>

<style scoped>
.bar { display: flex; gap: 10px; margin-bottom: 14px; }
.form { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; }
.item { display: flex; flex-direction: column; gap: 4px; min-width: 180px; }
.item label { font-size: 13px; color: var(--ds-text-3); }
</style>
