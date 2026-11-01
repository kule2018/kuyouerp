<template>
  <div class="recon-page">
    <DsCard>
      <DsTabs v-model="tab" :items="tabItems" @change="onTabChange" />

      <!-- 对账单检索：往来单位 / 业务员 / 日期区间 -->
      <div v-if="isRecon" class="filter-bar">
        <DsField label="开始日期"><DsDatePicker v-model="startDate" placeholder="开始" /></DsField>
        <DsField label="结束日期"><DsDatePicker v-model="endDate" placeholder="结束" /></DsField>
        <DsField label="业务员">
          <DsInput v-model="staffId" placeholder="业务员ID" />
        </DsField>
        <div class="filter-actions">
          <DsButton variant="primary" @click="load">查询</DsButton>
          <DsButton @click="reset">重置</DsButton>
        </div>
      </div>

      <!-- 收发汇总检索：商品编码 / 时间 -->
      <div v-else-if="tab === 'goods_log_summary'" class="filter-bar">
        <DsField label="商品编码">
          <DsInput v-model="goodsCode" placeholder="如 G001" />
        </DsField>
        <DsField label="开始日期"><DsDatePicker v-model="startDate" placeholder="开始" /></DsField>
        <DsField label="结束日期"><DsDatePicker v-model="endDate" placeholder="结束" /></DsField>
        <div class="filter-actions">
          <DsButton variant="primary" @click="load">查询</DsButton>
        </div>
      </div>

      <!-- 序列号检索：序列号 / 商品 / 库存状态 -->
      <div v-else class="filter-bar">
        <DsField label="商品">
          <DsInput v-model="goodsId" placeholder="商品ID，多个逗号分隔" />
        </DsField>
        <DsField label="序列号">
          <DsInput v-model="serial" placeholder="序列号，多个逗号分隔" />
        </DsField>
        <DsField label="库存状态">
          <DsSelect v-model="storeStatus" :options="storeStatusOptions" placeholder="全部" clearable />
        </DsField>
        <div class="filter-actions">
          <DsButton variant="primary" @click="load">查询</DsButton>
        </div>
      </div>
    </DsCard>

    <DsCard style="margin-top: 12px">
      <!-- ============ 对账单表：期初 / 流水 / 小计 三段式 ============ -->
      <DsTable v-if="isRecon" :columns="reconCols" :data="rows" :loading="loading" striped :row-class="rowClass">
        <template #business_type="{ row }">{{ businessName(row.business_type) }}</template>
        <template #sale_money="{ row }">{{ fmt(row.sale_money) }}</template>
        <template #receivable="{ row }">{{ fmt(row.receivable) }}</template>
        <template #amount="{ row }">{{ fmt(row.amount) }}</template>
        <template #cost="{ row }">{{ fmt(row.cost) }}</template>
        <template #real_money="{ row }">{{ fmt(row.real_money) }}</template>
        <template #balance="{ row }"><strong>{{ fmt(row.balance) }}</strong></template>
      </DsTable>

      <!-- ============ 商品收发明细汇总 ============ -->
      <DsTable v-else-if="tab === 'goods_log_summary'" :columns="goodsLogCols" :data="rows" :loading="loading" striped>
        <template #period_basics="{ row }">{{ fmt(row.period_basics) }}</template>
        <template #enter_basics="{ row }">{{ fmt(row.enter_basics) }}</template>
        <template #enter_cost="{ row }">{{ fmt(row.enter_cost) }}</template>
        <template #out_basics="{ row }">{{ fmt(row.out_basics) }}</template>
        <template #out_cost="{ row }">{{ fmt(row.out_cost) }}</template>
        <template #balance_basics="{ row }"><strong>{{ fmt(row.balance_basics) }}</strong></template>
        <template #balance_cost="{ row }"><strong>{{ fmt(row.balance_cost) }}</strong></template>
      </DsTable>

      <!-- ============ 序列号状态 ============ -->
      <DsTable v-else :columns="serialCols" :data="rows" :loading="loading" striped>
        <template #business_type="{ row }">{{ businessName(row.business_type) }}</template>
        <template #store_status="{ row }">
          <DsTag :color="Number(row.store_status) === 0 ? 'success' : 'neutral'" size="sm">
            {{ storeStatusName(row.store_status) }}
          </DsTag>
        </template>
        <template #purchase_time="{ row }">{{ fmtDate(row.purchase_time) }}</template>
      </DsTable>

      <!-- 对账单合计条 -->
      <div v-if="isRecon && rows.length" class="sum">
        合计：销售 {{ fmt(totals.all_sale_money) }} ｜ 应收/应付 {{ fmt(totals.all_receivable) }}
        ｜ 成本 {{ fmt(totals.all_cost) }} ｜ 实际收付 {{ fmt(totals.all_real_money) }}
        ｜ 余额 {{ fmt(totals.all_balance) }}
      </div>

      <DsPagination
        v-if="!isRecon && tab === 'goods_serial_status'"
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
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { customersRecon, suppliersRecon, goodsLogSummary, goodsSerialStatus } from '../api/recon';

/**
 * 对账与汇总页
 * 对应源端四个复合页面：CustomersRecon / SuppliersRecon / GoodsLogSummary / GoodsSerialStatus。
 * 对账单为「期初余额 → 逐笔流水 → 小计」三段式，不分页（与源一致，源直接 sizeof($listarr)）。
 */
const route = useRoute();
const tab = ref(
  {
    customer: 'customers',
    supplier: 'suppliers',
    serial: 'goods_serial_status',
  }[String(route.query.type) as 'customer' | 'supplier' | 'serial'] || 'customers',
);
const isRecon = computed(() => tab.value === 'customers' || tab.value === 'suppliers');

const rows = ref<any[]>([]);
const loading = ref(false);
const startDate = ref('');
const endDate = ref('');
const staffId = ref('');
const goodsCode = ref('');
const goodsId = ref('');
const serial = ref('');
const storeStatus = ref<any>('');
const page = ref(1);
const limit = ref(20);
const total = ref(0);
const totals = ref<any>({
  all_sale_money: 0,
  all_receivable: 0,
  all_cost: 0,
  all_real_money: 0,
  all_balance: 0,
});

/** 页签配置 */
const tabItems = [
  { label: '客户对账单', value: 'customers' },
  { label: '供应商对账单', value: 'suppliers' },
  { label: '商品收发明细汇总', value: 'goods_log_summary' },
  { label: '序列号状态', value: 'goods_serial_status' },
];

/** 库存状态下拉 */
const storeStatusOptions = [
  { label: '在库', value: 0 },
  { label: '已出库', value: 1 },
  { label: '已销售', value: 2 },
];

/** 对账单列（business_type 之后的金额列随 tab 语义复用） */
const reconCols = computed(() => [
  { title: '往来单位', key: 'customer_name', width: '160px' },
  { title: '单据日期', key: 'purchase_time', width: '110px' },
  { title: '单据编号', key: 'purchase_code', width: '160px' },
  { title: '业务类型', key: 'business_type', width: '100px', slot: true },
  { title: '销售金额', key: 'sale_money', width: '120px', align: 'right' as const, slot: true },
  { title: '应收/应付', key: 'receivable', width: '120px', align: 'right' as const, slot: true },
  { title: '金额', key: 'amount', width: '120px', align: 'right' as const, slot: true },
  { title: '成本', key: 'cost', width: '120px', align: 'right' as const, slot: true },
  { title: '实际收付', key: 'real_money', width: '120px', align: 'right' as const, slot: true },
  { title: '余额', key: 'balance', width: '130px', align: 'right' as const, slot: true },
  ...(tab.value === 'customers' ? [{ title: '业务员', key: 'staff_member', width: '110px' }] : []),
  { title: '备注', key: 'remark', minWidth: '160px' },
]);

/** 商品收发明细汇总列 */
const goodsLogCols = [
  { title: '商品编码', key: 'goods_code', width: '130px' },
  { title: '商品名称', key: 'goods_name', width: '160px' },
  { title: '规格', key: 'goods_spec', width: '100px' },
  { title: '分类', key: 'type_name', width: '100px' },
  { title: '仓库', key: 'store_name', width: '120px' },
  { title: '单位', key: 'unit_name', width: '80px' },
  { title: '期初数量', key: 'period_basics', width: '110px', align: 'right' as const, slot: true },
  { title: '入库数量', key: 'enter_basics', width: '110px', align: 'right' as const, slot: true },
  { title: '入库成本', key: 'enter_cost', width: '110px', align: 'right' as const, slot: true },
  { title: '出库数量', key: 'out_basics', width: '110px', align: 'right' as const, slot: true },
  { title: '出库成本', key: 'out_cost', width: '110px', align: 'right' as const, slot: true },
  { title: '结存数量', key: 'balance_basics', width: '120px', align: 'right' as const, slot: true },
  { title: '结存成本', key: 'balance_cost', width: '120px', align: 'right' as const, slot: true },
];

/** 序列号状态列 */
const serialCols = [
  { title: '序列号', key: 'serial', width: '180px' },
  { title: '商品编码', key: 'goods_code', width: '130px' },
  { title: '商品名称', key: 'goods_name', width: '160px' },
  { title: '规格', key: 'goods_spec', width: '100px' },
  { title: '仓库', key: 'store_name', width: '120px' },
  { title: '业务类型', key: 'business_type', width: '110px', slot: true },
  { title: '库存状态', key: 'store_status', width: '100px', slot: true },
  { title: '单据日期', key: 'purchase_time', width: '110px', slot: true },
  { title: '单据编号', key: 'purchase_code', width: '150px' },
  { title: '往来单位', key: 'customer_id', width: '150px' },
  { title: '备注', key: 'remarks', minWidth: '140px' },
];

/** 业务类型字典：与 kuyou_accounts_log.business_type 一致 */
const BUSINESS: Record<number, string> = {
  1: '期初余额', 2: '采购', 3: '购货付款', 4: '购货退货', 5: '销货', 6: '销货退货',
  7: '收款单', 8: '付款单', 9: '其他收入', 10: '其他支出', 11: '转账转入', 12: '转账转出',
};
function businessName(v: any) {
  return BUSINESS[Number(v)] || (v === '' || v === null || v === undefined ? '' : String(v));
}
function storeStatusName(v: any) {
  const n = Number(v);
  if (n === 0) return '在库';
  if (n === 1) return '已出库';
  if (n === 2) return '已销售';
  return String(v ?? '');
}

/** 数值格式化：空值显示 '-'，数值保留两位 */
function fmt(v: any) {
  if (v === '' || v === null || v === undefined) return '-';
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : String(v);
}

/** bigint 秒 → YYYY-MM-DD */
function fmtDate(t: any) {
  const n = Number(t);
  if (!n) return '';
  const d = new Date(n * 1000);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 期初 / 小计行加底色，便于阅读 */
/**
 * 行样式回调：期初余额 / 小计行加底色区分。
 * 注意：DsTable 的 rowClass 契约是 `(row, index) => string`，直接收到行对象，
 * 不能按 Element-Plus 的 `({ row })` 解构——那样取到的 row 恒为 undefined。
 *
 * @param row 当前行数据
 * @returns 行 class 名，无样式时返回空串
 */
function rowClass(row: any) {
  if (!row) return '';
  if (row.purchase_code === '期初余额' || row.purchase_code === '小计') return 'recon-subtotal';
  return '';
}

/** 构造日期区间过滤值（源端按 ' - ' 分隔解析） */
function rangeValue() {
  if (startDate.value && endDate.value) {
    return `${startDate.value} - ${endDate.value}`;
  }
  return '';
}

/** 按当前页签加载数据 */
async function load() {
  loading.value = true;
  try {
    if (tab.value === 'customers' || tab.value === 'suppliers') {
      const filter: Record<string, any> = {};
      const rv = rangeValue();
      if (rv) filter.purchase_time = rv;
      if (staffId.value) filter.staff_member_id = staffId.value;
      const res: any =
        tab.value === 'customers'
          ? await customersRecon(filter, 'createtime', 'ASC')
          : await suppliersRecon(filter, 'createtime', 'ASC');
      const data = res?.data || res || {};
      rows.value = data.rows || [];
      total.value = Number(data.total || 0);
      totals.value = {
        all_sale_money: Number(data.all_sale_money || 0),
        all_receivable: Number(data.all_receivable || 0),
        all_cost: Number(data.all_cost || 0),
        all_real_money: Number(data.all_real_money || 0),
        all_balance: Number(data.all_balance || 0),
      };
    } else if (tab.value === 'goods_log_summary') {
      const filter: Record<string, any> = {};
      if (goodsCode.value) filter.goods_code = goodsCode.value;
      const rv = rangeValue();
      if (rv) filter.purchase_time = rv;
      const res: any = await goodsLogSummary(filter);
      const data = res?.data || res || {};
      rows.value = data.rows || [];
      total.value = Number(data.total || 0);
    } else {
      const filter: Record<string, any> = {};
      if (goodsId.value) filter.goods_id = goodsId.value;
      if (serial.value) filter.serial = serial.value;
      const res: any = await goodsSerialStatus(filter, storeStatus.value, page.value, limit.value);
      const data = res?.data || res || {};
      rows.value = data.rows || [];
      total.value = Number(data.total || 0);
    }
  } catch (e: any) {
    rows.value = [];
    console.error(e);
  } finally {
    loading.value = false;
  }
}

/** 重置检索条件 */
function reset() {
  startDate.value = '';
  endDate.value = '';
  staffId.value = '';
  load();
}

/** 切换页签：清空数据后重载 */
function onTabChange() {
  rows.value = [];
  total.value = 0;
  page.value = 1;
  totals.value = {
    all_sale_money: 0,
    all_receivable: 0,
    all_cost: 0,
    all_real_money: 0,
    all_balance: 0,
  };
  load();
}

onMounted(load);
</script>

<style scoped>
/* 筛选栏排版由全局 form.css 统一提供，这里只补与上方 Tabs 的间距 */
.recon-page .filter-bar {
  margin-top: 14px;
}
.sum {
  margin-top: 12px;
  text-align: right;
  font-weight: 600;
}
:deep(.recon-subtotal) {
  background-color: var(--ds-bg-soft);
}
</style>
