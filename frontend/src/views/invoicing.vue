<template>
  <div class="invoice">
    <DsCard>
      <template #title>
        <span>{{ kind === 'purchase' ? '采购开票' : '销货开票' }}</span>
        <DsTag color="neutral" size="sm" style="margin-left: 10px">
          {{ kind === 'purchase' ? '供应商往来' : '客户往来' }}
        </DsTag>
      </template>

      <DsTabs v-model="tab" :items="tabItems" />

      <!-- ========== 开票登记 ========== -->
      <div v-if="tab === 'register'">
        <div class="reg-form">
          <DsField label="发票号" required>
            <DsInput v-model="invoiceNo" placeholder="请输入发票号" />
          </DsField>
          <DsField label="发票抬头" required>
            <DsInput v-model="invoiceHeader" placeholder="请输入发票抬头" />
          </DsField>
          <div class="filter-actions">
            <DsButton variant="primary" :disabled="!canRegister" :loading="regLoading" @click="doRegister">
              确认开票
            </DsButton>
            <DsButton :disabled="!pendingRows.length" @click="loadPending">刷新待开票</DsButton>
          </div>
        </div>

        <DsAlert
          v-if="!pendingRows.length"
          type="info"
          title="当前没有待开票记录（invoice_status=0）。采购/销货单据审核后会自动生成对应的开票记录。"
        />

        <DsTable
          v-else
          :columns="pendingCols"
          :data="pendingRows"
          selection
          striped
          style="margin-top: 8px"
          @selection-change="onSelect"
        >
          <template #invoicing="{ row }">
            <DsInput v-model="row.invoicing" type="number" :min="0" :step="1" style="width: 150px" />
          </template>
        </DsTable>
      </div>

      <!-- ========== 已登记 ========== -->
      <div v-else-if="tab === 'listed'">
        <div class="reg-form">
          <DsField label="开始日期"><DsDatePicker v-model="beginTime" type="date" /></DsField>
          <DsField label="结束日期"><DsDatePicker v-model="endTime" type="date" /></DsField>
          <DsField :label="kind === 'purchase' ? '供应商' : '客户'">
            <DsInput v-model="party" placeholder="编码/名称关键字" />
          </DsField>
          <DsField label="单据号"><DsInput v-model="billCodes" placeholder="单据编号" /></DsField>
          <div class="filter-actions">
            <DsButton variant="primary" @click="loadList">查询</DsButton>
          </div>
        </div>
        <DsTable :columns="listCols" :data="listRows" striped>
          <template #invoice_status="{ row }">
            <DsTag :color="row.invoice_status === '1' ? 'success' : 'warning'" size="sm">
              {{ row.invoice_status === '1' ? '已开' : '未开' }}
            </DsTag>
          </template>
        </DsTable>
        <DsPagination
          v-if="listTotal > listLimit"
          layout="prev, pager, next"
          :total="listTotal"
          :page-size="listLimit"
          :current-page="listPage"
          style="margin-top: 10px"
          @change="onListPage"
        />
      </div>

      <!-- ========== 开票台账 ========== -->
      <div v-else>
        <DsTable :columns="logCols" :data="logRows" striped>
          <template #act="{ row }">
            <DsButton variant="text" size="sm" class="danger-link" @click="delLog(row.id)">删除</DsButton>
          </template>
        </DsTable>
      </div>
    </DsCard>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@/components/ds/toast';
import { confirm } from '@/components/ds/useConfirm';
import {
  invoiceList,
  invoicePending,
  invoiceLog,
  invoiceRegister,
  invoiceDel,
} from '../api/invoicing';

const route = useRoute();
const toast = useToast();
const kind = computed<'purchase' | 'sales'>(() => (route.params.kind === 'sales' ? 'sales' : 'purchase'));

const tab = ref('register');
const invoiceNo = ref('');
const invoiceHeader = ref('');
const regLoading = ref(false);

const pendingRows = ref<any[]>([]);
const selected = ref<any[]>([]);

const beginTime = ref('');
const endTime = ref('');
const party = ref('');
const billCodes = ref('');
const listRows = ref<any[]>([]);
const listTotal = ref(0);
const listLimit = ref(15);
const listOffset = ref(0);
const listPage = ref(1);

const logRows = ref<any[]>([]);

const canRegister = computed(
  () => invoiceNo.value.trim() && invoiceHeader.value.trim() && selected.value.length > 0,
);

/** 页签配置 */
const tabItems = [
  { label: '开票登记', value: 'register' },
  { label: '已登记', value: 'listed' },
  { label: '开票台账', value: 'log' },
];

/** 待开票表列（含多选） */
const pendingCols = computed(() => [
  { title: kind.value === 'purchase' ? '供应商' : '客户', key: 'party_name', minWidth: '140px' },
  { title: '单据编号', key: 'bill_codes', width: '150px' },
  { title: '金额', key: 'money', width: '120px' },
  { title: '未开票金额', key: 'give_money', width: '120px' },
  { title: '本次开票金额', key: 'invoicing', width: '170px', slot: true },
]);

/** 已登记表列 */
const listCols = computed(() => [
  { title: kind.value === 'purchase' ? '供应商' : '客户', key: 'party_name', minWidth: '140px' },
  { title: '单据编号', key: 'bill_codes', width: '150px' },
  { title: '金额', key: 'money', width: '110px' },
  { title: '税额', key: 'tax', width: '110px' },
  { title: '价税合计', key: 'real_money', width: '110px' },
  { title: '已开票', key: 'pay_money', width: '110px' },
  { title: '未开票', key: 'give_money', width: '110px' },
  { title: '状态', key: 'invoice_status', width: '90px', slot: true },
  { title: '发票号', key: 'invoice', minWidth: '130px' },
  { title: '发票抬头', key: 'invoice_header', minWidth: '150px' },
]);

/** 开票台账表列 */
const logCols = computed(() => [
  { title: kind.value === 'purchase' ? '供应商' : '客户', key: 'party_name', minWidth: '140px' },
  { title: '单据编号', key: 'bill_codes', width: '150px' },
  { title: '金额', key: 'money', width: '110px' },
  { title: '本次开票', key: 'pay_money', width: '110px' },
  { title: '剩余未开', key: 'give_money', width: '110px' },
  { title: '发票号', key: 'invoice', width: '150px' },
  { title: '发票抬头', key: 'invoice_header', minWidth: '160px' },
  { title: '操作', key: 'act', width: '90px', fixed: 'right' as const, slot: true },
]);

watch(kind, () => {
  reset();
  loadPending();
});

/** 重置页面状态 */
function reset() {
  tab.value = 'register';
  invoiceNo.value = '';
  invoiceHeader.value = '';
  pendingRows.value = [];
  selected.value = [];
  listRows.value = [];
  logRows.value = [];
}

/** 载入待开票记录 */
async function loadPending() {
  try {
    const { data } = await invoicePending(kind.value);
    pendingRows.value = (data.rows || []).map((r: any) => ({ ...r, invoicing: Number(r.give_money) || 0 }));
  } catch (e: any) {
    toast.error(e?.message || '载入失败');
  }
}

/** 多选变化 */
function onSelect(rows: any[]) {
  selected.value = rows;
}

/** 确认开票登记 */
async function doRegister() {
  if (!canRegister.value) return;
  const rows = selected.value.map((r) => ({ id: r.id, invoicing: Number(r.invoicing) || 0 }));
  if (rows.some((r) => r.invoicing <= 0)) {
    toast.warning('本次开票金额必须大于 0');
    return;
  }
  if (!(await confirm(`确认对 ${rows.length} 条记录开具发票「${invoiceNo.value}」？`, '提示'))) return;
  try {
    regLoading.value = true;
    await invoiceRegister(kind.value, {
      rows,
      invoice: invoiceNo.value.trim(),
      invoice_header: invoiceHeader.value.trim(),
    });
    toast.success('开票登记成功');
    invoiceNo.value = '';
    invoiceHeader.value = '';
    await loadPending();
  } catch (e: any) {
    toast.error(e?.message || '开票失败');
  } finally {
    regLoading.value = false;
  }
}

/** 已登记查询 */
async function loadList() {
  try {
    const { data } = await invoiceList(kind.value, {
      offset: listOffset.value,
      limit: listLimit.value,
      begin_time: beginTime.value || undefined,
      end_time: endTime.value || undefined,
      party: party.value || undefined,
      bill_codes: billCodes.value || undefined,
    });
    listRows.value = data.rows || [];
    listTotal.value = data.total || 0;
  } catch (e: any) {
    toast.error(e?.message || '查询失败');
  }
}

/** 翻页 */
function onListPage(page: number) {
  listPage.value = page;
  listOffset.value = (page - 1) * listLimit.value;
  loadList();
}

/** 开票台账 */
async function loadLog() {
  try {
    const { data } = await invoiceLog(kind.value, {});
    logRows.value = data.rows || [];
  } catch (e: any) {
    toast.error(e?.message || '载入失败');
  }
}

/** 删除台账记录（回冲主表已开票金额） */
async function delLog(id: number) {
  if (!(await confirm('删除后将回冲主表已开票金额，确认？', '提示'))) return;
  try {
    await invoiceDel(kind.value, [id]);
    toast.success('删除成功');
    loadLog();
  } catch (e: any) {
    toast.error(e?.message || '删除失败');
  }
}

// 页签切换时懒加载对应数据
watch(tab, (t) => {
  if (t === 'listed' && !listRows.value.length) loadList();
  if (t === 'log' && !logRows.value.length) loadLog();
});

onMounted(loadPending);
</script>

<style scoped>
.invoice { padding: 4px; }
/* 栅格与字段间距由全局 form.css 提供，这里只保留本页上下留白 */
.reg-form {
  margin: 12px 0 6px;
}
.danger-link { color: var(--ds-danger); }
</style>
