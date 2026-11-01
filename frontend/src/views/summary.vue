<template>
  <div class="summary-page">
    <DsCard>
      <DsTabs v-model="tab" :items="tabItems" @change="onTabChange" />

      <!-- 检索：日期区间 + 往来维度关键字 -->
      <div class="filter-bar">
        <DsField label="开始日期">
          <DsDatePicker v-model="startDate" placeholder="开始" />
        </DsField>
        <DsField label="结束日期">
          <DsDatePicker v-model="endDate" placeholder="结束" />
        </DsField>
        <DsField label="关键字">
          <DsInput v-model="keyword" placeholder="商品/供应商/客户" />
        </DsField>
        <DsField v-if="tab === 'revenue'" label="业务类型">
          <DsSelect v-model="businessType" :options="businessTypeOptions" placeholder="全部" clearable />
        </DsField>
        <div class="filter-actions">
          <DsButton variant="primary" @click="load">查询</DsButton>
          <DsButton @click="reset">重置</DsButton>
        </div>
      </div>
    </DsCard>

    <DsCard style="margin-top: 12px">
      <!-- ============ 采购/销货汇总：明细 + 小计 + 合计 ============ -->
      <DsTable
        v-if="tab !== 'revenue'"
        :columns="sumCols"
        :data="rows"
        :loading="loading"
        striped
        :row-class="rowClass"
      >
        <template #supplyer_name="{ row }">
          {{ row.supplyer_name || '' }}
          <span v-if="row.supplier_type_name" class="dim">（{{ row.supplier_type_name }}）</span>
        </template>
      </DsTable>

      <!-- ============ 收入支出报表 ============ -->
      <DsTable v-else :columns="revenueCols" :data="rows" :loading="loading" striped>
        <template #business_type="{ row }">
          <DsTag :color="row.business_type === '其他收入' ? 'success' : 'warning'" size="sm">
            {{ row.business_type }}
          </DsTag>
        </template>
      </DsTable>

      <!-- 收入支出合计条 -->
      <div v-if="tab === 'revenue' && rows.length" class="sum">
        合计：收入 {{ fmt(totalIn) }} ｜ 支出 {{ fmt(totalOut) }}
      </div>
    </DsCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { purchaseSummarys, salesSummarys, salesSummaryc, revenue } from '../api/summary';

/**
 * 汇总报表页
 * 对应源端：GoodsPurchaseSummarys（采购汇总）/ GoodsSalesSummarys（销货汇总-业务员）/
 * GoodsSalesSummaryc（销货汇总-客户）/ Revenue（收入支出报表）。
 * 汇总表为「明细 → 小计 → 合计」结构，其中小计/合计行的 s_name 由后端打标。
 */
const tab = ref('purchase');
const rows = ref<any[]>([]);
const loading = ref(false);
const startDate = ref('');
const endDate = ref('');
const keyword = ref('');
const businessType = ref<any>('');

/** 页签配置 */
const tabItems = [
  { label: '采购汇总（按供应商）', value: 'purchase' },
  { label: '销货汇总（按业务员）', value: 'sale_user' },
  { label: '销货汇总（按客户）', value: 'sale_customer' },
  { label: '收入支出报表', value: 'revenue' },
];

/** 业务类型下拉 */
const businessTypeOptions = [
  { label: '其他收入', value: 1 },
  { label: '其他支出', value: 2 },
];

const totalIn = computed(() =>
  rows.value.filter((r) => r.business_type === '其他收入').reduce((a, r) => a + Number(r.receivable || 0), 0),
);
const totalOut = computed(() =>
  rows.value.filter((r) => r.business_type === '其他支出').reduce((a, r) => a + Number(r.amount || 0), 0),
);

/** 小计/合计行高亮类名 */
/**
 * 行样式回调：小计 / 合计行加粗底色。
 * 注意：DsTable 的 rowClass 契约是 `(row, index) => string`，直接收到行对象，
 * 不能按 Element-Plus 的 `({ row })` 解构——那样取到的 row 恒为 undefined。
 *
 * @param row 当前行数据
 * @returns 行 class 名，无样式时返回空串
 */
function rowClass(row: any) {
  if (!row) return '';
  return row.s_name === '小计' || row.s_name === '合计' ? 'sum-row' : '';
}

/** 采购/销货汇总列配置 */
const sumCols = computed(() => [
  { title: '商品编码', key: 'goods_code', width: '130px' },
  { title: '商品名称', key: 'goods_name', width: '160px' },
  { title: '规格', key: 'goods_specification_id', width: '100px' },
  { title: '仓库', key: 's_name', width: '110px' },
  { title: '单位', key: 'u_name', width: '80px' },
  { title: '单位换算', key: 'unit_conversion', minWidth: '140px' },
  { title: '数量', key: 'basic_nmber', width: '110px', align: 'right' as const, formatter: (v: any) => fmt(v) },
  { title: '单价', key: 'unit_price', width: '100px', align: 'right' as const, formatter: (v: any) => fmt(v) },
  { title: '金额', key: 'all_money', width: '120px', align: 'right' as const, formatter: (v: any) => fmt(v) },
  { title: '税额', key: 'tax_money', width: '110px', align: 'right' as const, formatter: (v: any) => fmt(v) },
  { title: '价税合计', key: 'money_tax_price', width: '120px', align: 'right' as const, formatter: (v: any) => fmt(v) },
  { title: '往来方', key: 'supplyer_name', width: '150px', slot: true },
]);

/** 收入支出报表列配置 */
const revenueCols = computed(() => [
  { title: '单据日期', key: 'purchase_time', width: '120px' },
  { title: '单据编号', key: 'purchase_code', width: '160px' },
  { title: '业务类型', key: 'business_type', width: '110px', slot: true },
  { title: '收入/支出类别', key: 'name', width: '160px' },
  { title: '收入金额', key: 'receivable', width: '120px', align: 'right' as const, formatter: (v: any) => fmt(v) },
  { title: '支出金额', key: 'amount', width: '120px', align: 'right' as const, formatter: (v: any) => fmt(v) },
  { title: '往来单位', key: 'intercourse', width: '160px' },
  { title: '备注', key: 'remark', minWidth: '160px' },
]);

/** 数值格式化：空串显示 '-' */
function fmt(v: any) {
  if (v === '' || v === null || v === undefined) return '-';
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : String(v);
}

/** 构造检索过滤（源端按 ' - ' 分隔解析日期） */
function buildFilter() {
  const f: Record<string, any> = {};
  if (startDate.value && endDate.value) {
    f.purchase_time = `${startDate.value} - ${endDate.value}`;
  }
  if (tab.value === 'purchase') {
    if (keyword.value) f.supplyer_code = keyword.value;
  } else if (tab.value === 'sale_customer') {
    if (keyword.value) f.customers_id = keyword.value;
  } else if (keyword.value) {
    f.goods_name = keyword.value;
  }
  if (tab.value === 'revenue' && businessType.value !== '' && businessType.value !== null) {
    f.business_type = businessType.value;
  }
  return f;
}

/** 按当前页签加载报表数据 */
async function load() {
  loading.value = true;
  try {
    const f = buildFilter();
    const field = tab.value === 'sale_user' ? 'staff_member_id' : tab.value === 'sale_customer' ? 'customers_id' : 'supplyer_code';
    let res: any;
    if (tab.value === 'purchase') res = await purchaseSummarys(f, field, 'DESC');
    else if (tab.value === 'sale_user') res = await salesSummarys(f, field, 'DESC');
    else if (tab.value === 'sale_customer') res = await salesSummaryc(f, field, 'DESC');
    else res = await revenue(f);
    const data = res?.data || res || {};
    rows.value = data.rows || [];
  } catch (e) {
    rows.value = [];
    console.error(e);
  } finally {
    loading.value = false;
  }
}

/** 重置检索条件并重新加载 */
function reset() {
  startDate.value = '';
  endDate.value = '';
  keyword.value = '';
  businessType.value = '';
  load();
}

/** 切换页签：清空数据后重载 */
function onTabChange() {
  rows.value = [];
  load();
}

onMounted(load);
</script>

<style scoped>
/* 筛选栏排版由全局 form.css 统一提供，这里只补与上方 Tabs 的间距 */
.summary-page .filter-bar {
  margin-top: 14px;
}
.sum {
  margin-top: 12px;
  text-align: right;
  font-weight: 600;
}
.dim {
  color: var(--ds-text-3);
  font-size: 12px;
}
:deep(.sum-row) {
  background: color-mix(in srgb, var(--ds-warning) 12%, transparent);
  font-weight: 600;
}
</style>
