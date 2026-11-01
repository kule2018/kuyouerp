<template>
  <div class="print-page">
    <!-- 控制区（打印时隐藏） -->
    <div class="print-toolbar no-print">
      <DsCard>
        <div class="reg-form">
          <DsField label="打印类型">
            <DsSelect
              v-model="selectedType"
              :options="typeOptions"
              placeholder="选择打印类型"
              filterable
              @change="onTypeChange"
            />
          </DsField>

          <DsField v-if="currentMode === 'document'" label="单据ID">
            <DsInput v-model="idsInput" placeholder="多个用逗号分隔，如 1,2,3" />
          </DsField>
          <template v-else>
            <DsField label="关键字">
              <DsInput v-model="searchKey" placeholder="编码/名称关键字" />
            </DsField>
            <DsField label="开始">
              <DsDatePicker v-model="startDate" type="date" />
            </DsField>
            <DsField label="结束">
              <DsDatePicker v-model="endDate" type="date" />
            </DsField>
          </template>

          <div class="filter-actions">
            <DsButton variant="primary" :loading="loading" @click="preview">预览</DsButton>
            <DsButton :disabled="!payload" @click="doPrint">打印</DsButton>
          </div>
        </div>
      </DsCard>
    </div>

    <!-- 预览区（打印内容） -->
    <div v-if="payload" class="print-sheet">
      <div class="company">{{ payload.company_name }}</div>

      <!-- 单据模式 -->
      <template v-if="currentMode === 'document'">
        <div v-for="(row, ri) in payload.list" :key="ri" class="doc-block">
          <h2 class="doc-title">{{ payload.title }}</h2>
          <table class="doc-head">
            <tr>
              <td>单据编号：{{ row.purchase_code || row.bill_code || row.id }}</td>
              <td>业务日期：{{ formatTime(row.purchase_time || row.bill_time) }}</td>
            </tr>
            <tr>
              <td>往来单位：{{ partyName(row) }}</td>
              <td>制单人：{{ row.preparation?.username || row.preparation?.nickname || '' }}</td>
            </tr>
            <tr v-if="row.note !== undefined">
              <td colspan="2">备注：{{ row.note }}</td>
            </tr>
          </table>

          <!-- 收付款单：账户明细 -->
          <table v-if="row.payment_account" class="doc-table">
            <thead>
              <tr><th>结算账号</th><th>结算方式</th><th>金额</th></tr>
            </thead>
            <tbody>
              <tr v-for="(a, ai) in row.payment_account" :key="ai">
                <td>{{ a.accounts?.name || a.accounts_id }}</td>
                <td>{{ a.settlementtype }}</td>
                <td>{{ money(a.money) }}</td>
              </tr>
            </tbody>
          </table>

          <!-- 通用明细（purchase_info / info_list / purchase_info） -->
          <table v-if="detailRows(row).length" class="doc-table">
            <thead>
              <tr>
                <th>序号</th><th>商品</th><th>单位</th><th>仓库</th><th>数量</th><th>单价</th><th>金额</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(d, di) in detailRows(row)" :key="di">
                <td>{{ di + 1 }}</td>
                <td>{{ d.goods?.goods_name || d.goods_name || '-' }}</td>
                <td>{{ d.unit?.name || '-' }}</td>
                <td>{{ storeText(d) }}</td>
                <td>{{ num(d.number) }}</td>
                <td>{{ money(linePrice(d)) }}</td>
                <td>{{ money(lineMoney(d)) }}</td>
              </tr>
            </tbody>
          </table>

          <!-- 合计行 -->
          <table class="doc-total">
            <tr>
              <td>合计数量：{{ num(row.print_number) }}</td>
              <td>合计金额：{{ money(row.print_money) }}</td>
              <td v-if="row.print_money_c">金额大写：{{ row.print_money_c }}</td>
            </tr>
          </table>
          <div class="page-break" />
        </div>
      </template>

      <!-- 汇总模式 -->
      <template v-else>
        <h2 class="doc-title">{{ payload.title }}</h2>
        <table class="doc-table">
          <thead>
            <tr>
              <th v-for="col in summaryCols" :key="col">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, ri) in payload.list" :key="ri">
              <td v-for="col in summaryCols" :key="col">{{ formatCell(r[col]) }}</td>
            </tr>
          </tbody>
          <tfoot v-if="payload.totals">
            <tr>
              <td v-for="col in summaryCols" :key="col">{{ col === summaryCols[0] ? '合计' : formatCell(payload.totals[col]) }}</td>
            </tr>
          </tfoot>
        </table>
      </template>
    </div>

    <DsEmpty v-else title="请选择打印类型并点击预览" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@/components/ds/toast';
import { printTypes, printData, PrintType } from '../api/print';

// 支持从单据页「打印 / 打印选中」跳转过来：?type=xxx&ids=1,2,3
const route = useRoute();
const toast = useToast();

const allTypes = ref<PrintType[]>([]);
const selectedType = ref('');
const idsInput = ref('');
const searchKey = ref('');
const startDate = ref('');
const endDate = ref('');
const loading = ref(false);
const payload = ref<any>(null);

const docTypes = computed(() => allTypes.value.filter((t) => t.mode === 'document'));
const sumTypes = computed(() => allTypes.value.filter((t) => t.mode === 'summary'));
const currentMode = computed(() => allTypes.value.find((t) => t.key === selectedType.value)?.mode || 'document');

/** 打印类型下拉选项（单据 / 汇总两类展平） */
const typeOptions = computed(() => [
  ...docTypes.value.map((t) => ({ label: t.title, value: t.key })),
  ...sumTypes.value.map((t) => ({ label: t.title, value: t.key })),
]);

onMounted(async () => {
  try {
    allTypes.value = (await printTypes()) as any;
    // 优先采用 URL 传入的打印类型（单据页跳转），其次取首个可用类型
    const qType = String(route.query.type || '');
    const qIds = String(route.query.ids || '');
    const hit = allTypes.value.find((t) => t.key === qType);
    selectedType.value = hit ? hit.key : allTypes.value[0]?.key || '';
    if (qIds) {
      idsInput.value = qIds;
      // 直接预览，省去用户再点一次
      preview();
    }
  } catch (e) {
    console.error(e);
  }
});

/** 切换打印类型：清空已预览内容 */
function onTypeChange() {
  payload.value = null;
}

/** 预览：按类型拉取打印数据 */
async function preview() {
  if (!selectedType.value) return;
  loading.value = true;
  try {
    const search: Record<string, any> = {};
    if (currentMode.value === 'summary') {
      if (searchKey.value) {
        // 关键字落到首个检索列
        const colMap: Record<string, string> = {
          cgmx: 'goods_code', cgddgz: 'goods_code', cghzb_sp: 'goods_code', cghzb_gys: 'supplyer_code', cgfk: 'suppliers_code', xsddgz: 'goods_code',
        };
        search[colMap[selectedType.value] || 'goods_code'] = searchKey.value;
      }
      if (startDate.value && endDate.value) {
        search.purchase_time = `${startDate.value} 00:00:00 - ${endDate.value} 23:59:59`;
      }
    }
    const ids = currentMode.value === 'document'
      ? idsInput.value.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    payload.value = await printData(selectedType.value, ids, search);
  } catch (e: any) {
    payload.value = null;
    toast.error(e?.message || '预览失败');
  } finally {
    loading.value = false;
  }
}

/** 调起浏览器打印 */
function doPrint() {
  window.print();
}

// ===== 渲染辅助 =====
function detailRows(row: any): any[] {
  return row.info_list || row.purchase_info || row.payment_info || [];
}
function storeText(d: any): string {
  if (d.stores_out && d.stores_enter) return `${d.stores_out?.name || ''} → ${d.stores_enter?.name || ''}`;
  return d.stores?.name || d.stores_id || '-';
}
function linePrice(d: any): number {
  return d.unit_price ?? d.price ?? d.cost_money ?? 0;
}
function lineMoney(d: any): number {
  return d.money_tax_price ?? d.price ?? d.cost_money ?? d.money ?? 0;
}
function partyName(row: any): string {
  if (row.suppliers) return row.suppliers.supplyer_name || row.suppliers.supplyer_code || '';
  if (row.customers) return row.customers.customer_name || '';
  if (typeof row.customers_id === 'string' && row.customers_id) return row.customers_id;
  if (typeof row.suppliers_id === 'string' && row.suppliers_id) return row.suppliers_id;
  return '';
}
function formatTime(v: any): string {
  if (!v) return '';
  if (typeof v === 'number') {
    const d = new Date(v * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return String(v);
}
function num(v: any): string {
  return v === undefined || v === null ? '-' : Number(v).toLocaleString();
}
function money(v: any): string {
  return v === undefined || v === null ? '-' : Number(v).toFixed(2);
}
function formatCell(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return '';
  return String(v);
}
const summaryCols = computed(() => {
  if (!payload.value?.list?.length) return [];
  const skip = new Set(['goods', 'unit', 'stores', 'suppliers', 'accounts']);
  const row = payload.value.list[0];
  return Object.keys(row).filter((k) => !skip.has(k) && typeof row[k] !== 'object');
});
</script>

<style scoped>
.print-page { padding: 16px; }
/* 栅格与字段间距由全局 form.css 提供 */
.print-sheet { background: #fff; padding: 24px; max-width: 900px; margin: 12px auto 0; }
.company { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 8px; }
.doc-title { text-align: center; font-size: 18px; margin: 12px 0; }
.doc-block { margin-bottom: 24px; page-break-inside: avoid; }
.doc-head { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
.doc-head td { padding: 4px 8px; font-size: 13px; }
.doc-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; }
.doc-table th, .doc-table td { border: 1px solid #666; padding: 4px 6px; text-align: left; }
.doc-table th { background: #f5f5f5; font-weight: 600; }
.doc-total { width: 100%; border-collapse: collapse; margin-top: 8px; }
.doc-total td { padding: 4px 8px; font-size: 13px; font-weight: bold; }
.page-break { page-break-after: always; }
@media print {
  .no-print { display: none !important; }
  .print-sheet { max-width: 100%; padding: 0; }
}
</style>
