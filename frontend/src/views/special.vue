<template>
  <div class="special">
    <!-- ============ MRP 计算 ============ -->
    <template v-if="type === 'mrp'">
      <DsCard>
        <template #title><span>MRP 计算</span></template>
        <div class="filter-bar">
          <DsField label="生产计划单号">
            <DsSelect
              v-model="planCode"
              :options="planOptions"
              remote
              filterable
              clearable
              placeholder="输入计划单号搜索"
              :loading="planLoading"
              @search="searchPlan"
            />
          </DsField>
          <div class="filter-actions">
            <DsButton variant="primary" :disabled="!planCode" @click="loadPlanLines">载入明细</DsButton>
            <DsButton :disabled="!planDetailRows.length" @click="runMrp">执行计算</DsButton>
          </div>
        </div>

        <DsAlert
          v-if="!planDetailRows.length"
          type="info"
          title="选择一个生产计划单号后载入明细行，勾选需要的行再执行计算。系统会按 BOM 逐级展开子件，扣除现有库存后得出建议采购量。"
        />

        <DsTable
          v-if="planDetailRows.length"
          :columns="planLineCols"
          :data="planDetailRows"
          selection
          striped
          style="margin-top: 12px"
          @selection-change="onPlanSelect"
        />
      </DsCard>

      <DsCard style="margin-top: 12px">
        <template #title><span>计算结果</span></template>
        <DsTable :columns="mrpCols" :data="mrpRows" striped>
          <template #act="{ row }">
            <DsButton variant="text" size="sm" @click="loadMrpDetail(row.id)">明细</DsButton>
          </template>
        </DsTable>
      </DsCard>

      <DsDrawer v-model="mrpDrawer" title="物料需求明细" :size="'60%'">
        <DsTable :columns="mrpLineCols" :data="mrpLines" striped />
      </DsDrawer>
    </template>

    <!-- ============ 智能补货 ============ -->
    <template v-else-if="type === 'replenishment'">
      <DsCard>
        <template #title><span>智能补货</span></template>
        <div class="filter-bar">
          <DsField label="开始日期"><DsDatePicker v-model="repStart" type="date" /></DsField>
          <DsField label="结束日期"><DsDatePicker v-model="repEnd" type="date" /></DsField>
          <div class="filter-actions">
            <DsButton variant="primary" @click="loadReplenishment">查询</DsButton>
          </div>
        </div>
        <DsAlert
          type="info"
          title="建议采购量 = 区间销售需求量 + 最低安全库存 - 现有库存 - 在途采购量（不足时取 0）"
        />
        <DsTable :columns="repCols" :data="repRows" striped style="margin-top: 12px" />
      </DsCard>
    </template>

    <!-- ============ 已销订购看板 ============ -->
    <template v-else-if="type === 'sold'">
      <DsCard>
        <template #title><span>已销订购看板</span></template>
        <div class="filter-bar">
          <DsField label="关键字">
            <DsInput v-model="soldKeyword" placeholder="商品编号 / 名称" clearable />
          </DsField>
          <div class="filter-actions">
            <DsButton variant="primary" @click="loadSold">查询</DsButton>
            <!-- 生成购货订单：源 purchaseby 工具栏 lay-event="add"（勾选行 → 校验 → 带明细跳单据新增页） -->
            <DsButton variant="ghost" :disabled="!soldSelected.length" @click="makePurchaseOrder">
              生成购货单{{ soldSelected.length ? `（${soldSelected.length}）` : '' }}
            </DsButton>
          </div>
        </div>
        <DsTable
          :columns="soldCols"
          :data="soldRows"
          striped
          row-key="id"
          selection
          reserve-selection
          @selection-change="(v: any[]) => (soldSelected = v)"
        >
          <!-- 本次采购数量 / 单价：源 purchaseby 的 edit:'number' 列，可直接改后下单 -->
          <template #now_buy_number="{ row }">
            <DsInput v-model="row.now_buy_number" type="number" min="0" size="sm" placeholder="本次采购数量" />
          </template>
          <template #buy_price="{ row }">
            <DsInput v-model="row.buy_price" type="number" min="0" step="0.0001" size="sm" placeholder="本次采购单价" />
          </template>
        </DsTable>
      </DsCard>
    </template>

    <!-- ============ 工资 ============ -->
    <template v-else-if="type === 'wages'">
      <DsCard>
        <template #title><span>工资</span></template>
        <DsTabs v-model="wageType" :items="wageTypeItems" @change="loadWages" />
        <DsAlert
          type="info"
          title="计件：验收数量 × BOM 工序计件单价；计时：工时 × BOM 工序工时单价"
        />
        <DsTable :columns="wageCols" :data="wageRows" striped style="margin-top: 12px" />
      </DsCard>
    </template>

    <!-- ============ 结账 / 反结账 ============ -->
    <template v-else-if="type === 'checkout'">
      <DsCard>
        <template #title><span>结账 / 反结账</span></template>
        <DsDescriptions
          :items="coDescItems"
          :data="coStatus"
          :column="2"
          bordered
          style="margin-bottom: 12px"
        />
        <div class="filter-bar">
          <DsField label="结账日期">
            <DsDatePicker v-model="checkDate" type="date" />
          </DsField>
          <div class="filter-actions">
            <DsButton variant="primary" @click="runCheckout">结账</DsButton>
            <DsButton variant="ghost" class="danger-link" @click="runUndo">反结账</DsButton>
          </div>
        </div>
        <DsAlert
          type="warning"
          title="结账会对全部商品做期末成本快照，并回填本期销售明细的销售成本；反结账将回滚最后一次结账。结账日期必须晚于系统启用日期与上次结账日期。"
        />
      </DsCard>
    </template>

    <!-- ============ 系统初始化 ============ -->
    <template v-else-if="type === 'init'">
      <DsCard>
        <template #title><span>系统初始化</span></template>
        <DsAlert
          type="danger"
          title="危险操作：将清空全部业务数据（商品、单据、库存、财务记录等），并把系统参数恢复为出厂默认值。此操作不可恢复。"
        />
        <div class="filter-bar" style="margin-top: 14px">
          <DsField label="确认口令">
            <DsInput v-model="initConfirm" placeholder="请输入 INITIALIZE" />
          </DsField>
          <div class="filter-actions">
            <DsButton variant="danger" @click="runInit">执行初始化</DsButton>
          </div>
        </div>
      </DsCard>
    </template>

    <DsAlert v-else type="danger" title="未知的专项页面类型" />
  </div>
</template>

<script setup lang="ts">
/**
 * 专项业务页面
 *
 * 路由 /special/:type，按 type 切换六个计算型业务面板。
 * 这些页面都有真实的后台算法，不是标准列表页，因此单独成页而非走通用 CRUD。
 */
import { ref, reactive, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from '@/components/ds/toast';
import { confirm } from '@/components/ds/useConfirm';
import {
  planLines,
  mrpList,
  mrpDetail,
  mrpCompute,
  replenishment,
  soldOrdered,
  wages,
  checkoutStatus,
  doCheckout,
  undoCheckout,
  initialization,
} from '../api/special';
import { selectpage } from '../api/dynamic';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const type = ref(String(route.params.type || ''));

/** 统一取数：兼容拦截器返回 data 与裸数据两种形态 */
function pick(res: any): any {
  return res?.data ?? res ?? {};
}

/* ---------------- MRP ---------------- */
const planCode = ref('');
const planLoading = ref(false);
const planOptions = ref<Array<{ label: string; value: string }>>([]);
/** 计划明细行 */
const planDetailRows = ref<any[]>([]);
const selectedPlanIds = ref<Array<number | string>>([]);
const mrpRows = ref<any[]>([]);
const mrpLines = ref<any[]>([]);
const mrpDrawer = ref(false);

/** MRP 计划明细列（含多选） */
const planLineCols = [
  { title: '商品编号', key: 'goods_code', width: '140px' },
  { title: '商品名称', key: 'goods_name', minWidth: '160px' },
  { title: '计划产量', key: 'number', width: '110px' },
  { title: '基本数量', key: 'basic_nmber', width: '110px' },
  { title: '备注', key: 'remark', minWidth: '140px' },
];
/** MRP 计算结果列 */
const mrpCols = [
  { title: 'ID', key: 'id', width: '70px' },
  { title: '计划单号', key: 'purchase_code', width: '160px' },
  { title: '产品编号', key: 'goods_code', width: '140px' },
  { title: '操作', key: 'act', width: '90px', fixed: 'right' as const, slot: true },
];
/** MRP 物料需求明细列 */
const mrpLineCols = [
  { title: '物料编号', key: 'goods_code', width: '140px' },
  { title: '物料名称', key: 'goods_name', minWidth: '150px' },
  { title: '毛需求', key: 'number', width: '100px' },
  { title: '基本数量', key: 'basic_nmber', width: '100px' },
  { title: '现有库存', key: 'stock', width: '100px' },
  { title: '建议采购', key: 'buy_number', width: '110px' },
  { title: '预计金额', key: 'money', width: '110px' },
];

/** 远程搜索生产计划单 */
async function searchPlan(q: string) {
  if (!q) return;
  planLoading.value = true;
  try {
    const res: any = await selectpage('kuyou_plan', { search: q, limit: 20 });
    const list = pick(res)?.rows || [];
    planOptions.value = list.map((r: any) => ({
      label: `${r.purchase_code} ${r.goods_name || ''}`.trim(),
      value: r.purchase_code,
    }));
  } catch {
    planOptions.value = [];
  } finally {
    planLoading.value = false;
  }
}

/** 载入计划明细行 */
async function loadPlanLines() {
  const res: any = await planLines(planCode.value);
  const data = pick(res);
  planDetailRows.value = data?.lines || [];
  await loadMrpRows();
}

/** 勾选计划行 */
function onPlanSelect(sel: any[]) {
  selectedPlanIds.value = sel.map((s) => s.id);
}

/** 加载 MRP 计算结果列表 */
async function loadMrpRows() {
  const res: any = await mrpList({ limit: 50 });
  mrpRows.value = pick(res)?.rows || [];
}

/** 执行 MRP 计算 */
async function runMrp() {
  if (!planCode.value) return;
  const res: any = await mrpCompute(planCode.value, selectedPlanIds.value);
  const data = pick(res);
  toast.success(`计算完成，生成 ${data?.lines ?? 0} 条物料需求`);
  await loadMrpRows();
}

/** 查看某次计算的物料需求明细 */
async function loadMrpDetail(id: number) {
  const res: any = await mrpDetail(id);
  const data = pick(res);
  mrpLines.value = data?.lines || [];
  mrpDrawer.value = true;
}

/* ---------------- 智能补货 ---------------- */
const repStart = ref('');
const repEnd = ref('');
const repRows = ref<any[]>([]);

/** 智能补货列 */
const repCols = [
  { title: '商品编号', key: 'goods_code', width: '140px' },
  { title: '商品名称', key: 'goods_name', minWidth: '150px' },
  { title: '单位', key: 'unit_name', width: '90px' },
  { title: '销售需求', key: 'sale_number', width: '110px' },
  { title: '现有库存', key: 'stock', width: '110px' },
  { title: '最低库存', key: 'min_stock', width: '110px' },
  { title: '在途采购', key: 'purchase_number', width: '110px' },
  { title: '建议采购', key: 'suggest_number', width: '120px', fixed: 'right' as const },
];

/** 查询补货建议 */
async function loadReplenishment() {
  const res: any = await replenishment({ start_time: repStart.value, end_time: repEnd.value });
  repRows.value = pick(res)?.rows || [];
}

/* ---------------- 已销订购看板 ---------------- */
const soldKeyword = ref('');
const soldRows = ref<any[]>([]);
/** 看板中勾选待下单的行 */
const soldSelected = ref<any[]>([]);

/** 已销订购看板列 */
const soldCols = [
  { title: '销售订单号', key: 'purchase_code', width: '170px' },
  { title: '商品编号', key: 'goods_code', width: '130px' },
  { title: '商品名称', key: 'goods_name', minWidth: '140px' },
  { title: '客户', key: 'customers_name', width: '140px' },
  { title: '已销数量', key: 'sale_number', width: '100px' },
  { title: '已出库', key: 'out_number', width: '100px' },
  { title: '已订购', key: 'sold_number', width: '100px' },
  { title: '待采购数量', key: 'buy_number', width: '110px' },
  { title: '本次采购数量', key: 'now_buy_number', width: '130px' },
  { title: '本次采购单价', key: 'buy_price', width: '130px' },
  { title: '采购单号', key: 'ordered_code', width: '170px' },
  { title: '审核状态', key: 'ordered_status', width: '100px', fixed: 'right' as const },
];

/** 查询已销订购看板 */
async function loadSold() {
  const res: any = await soldOrdered({ keyword: soldKeyword.value });
  const body: any = pick(res);
  // 后端返回 {total, rows}；部分网关会直接透传数组，两种都兼容
  soldRows.value = Array.isArray(body) ? body : body?.rows || [];
  soldSelected.value = [];
}

/**
 * 按勾选行生成购货订单（源 purchaseby 工具栏 add + setdata）。
 *
 * 源端先把组包行 POST 到 purchaseby/setdata 存 session，再打开购货订单新增页读取；
 * 迁移版为无状态 SPA，改用 sessionStorage 传草稿单，由 document.vue 挂载时消费，
 * 语义等价且不依赖后端会话。
 *
 * @returns 无；校验不通过时以 toast 提示并中断
 */
function makePurchaseOrder() {
  const rows = soldSelected.value;
  if (!rows.length) return toast.warning('请先勾选要采购的行');
  // 校验顺序与源端一致：待采购数量 → 本次采购数量 → 本次采购单价
  if (rows.some((r) => Number(r.buy_number) <= 0)) {
    return toast.error('待采购数量需大于 0，否则无法生成购货订单！');
  }
  if (rows.some((r) => r.now_buy_number === '' || r.now_buy_number === null || r.now_buy_number === undefined)) {
    return toast.error('请输入本次采购数量！');
  }
  if (rows.some((r) => r.buy_price === '' || r.buy_price === null || r.buy_price === undefined)) {
    return toast.error('请输入本次采购单价！');
  }
  // 组装购货订单明细行（源 setdata 组包字段：商品/属性/单位/仓库/数量/单价 + 源销售订单号）
  const lines = rows.map((r) => ({
    goods_code: r.goods_code,
    goods_attr: r.goods_attr,
    goods_unit: r.goods_unit,
    stores_id: r.stores_id,
    number: Number(r.now_buy_number),
    unit_price: Number(r.buy_price),
    all_money: Number((Number(r.now_buy_number) * Number(r.buy_price)).toFixed(4)),
    sales_order_id: r.purchase_code,
  }));
  // 引用列的显示名：目标页下拉若未加载到该项会显示空，带上名称可合成选项回显
  const labels: Record<string, Record<string, string>> = { goods_code: {}, goods_unit: {}, stores_id: {} };
  for (const r of rows) {
    labels.goods_code[r.goods_code] = r.goods_name;
    labels.goods_unit[r.goods_unit] = r.unit_name;
    labels.stores_id[r.stores_id] = r.stores_name;
  }
  // 草稿存 sessionStorage：路由跳转不丢，且刷新后由接收方清理
  sessionStorage.setItem('ds-doc-draft:kuyou_goods_purchase_order', JSON.stringify({ lines, labels }));
  // type=1：源 goods_purchase_order/add?type=1（以销定购来源标记）
  router.push({ name: 'document', params: { table: 'kuyou_goods_purchase_order' }, query: { type: '1' } });
}

/* ---------------- 工资 ---------------- */
const wageType = ref(String(route.query.wage) === 'hour' ? 'hour' : 'piece');
const wageRows = ref<any[]>([]);

/** 工资页签 */
const wageTypeItems = [
  { label: '计件工资', value: 'piece' },
  { label: '计时工资', value: 'hour' },
];

/** 工资列 */
const wageCols = [
  { title: '验收单号', key: 'acceptance_code', width: '160px' },
  { title: '工号', key: 'staff_code', width: '110px' },
  { title: '姓名', key: 'staff_name', width: '110px' },
  { title: '车间', key: 'workshop_name', width: '130px' },
  { title: '工时', key: 'work_time', width: '90px' },
  { title: '完工数量', key: 'finish_number', width: '110px' },
  { title: '工资金额', key: 'wages', width: '120px', fixed: 'right' as const },
];

/** 查询工资 */
async function loadWages() {
  const res: any = await wages({ type: wageType.value });
  wageRows.value = pick(res)?.rows || [];
}

/* ---------------- 结账 ---------------- */
const coStatus = reactive({ enable_time: '', last_checkdate: '' });
const checkDate = ref('');

/** 结账状态描述列表 */
const coDescItems = [
  { label: '系统启用日期', key: 'enable_time' },
  { label: '上次结账日期', key: 'last_checkdate', formatter: (v: any) => v || '尚未结账' },
];

/** 加载结账状态 */
async function loadCheckoutStatus() {
  const res: any = await checkoutStatus();
  const data = pick(res);
  coStatus.enable_time = data?.enable_time || '';
  coStatus.last_checkdate = data?.last_checkdate || '';
}

/** 执行结账 */
async function runCheckout() {
  if (!checkDate.value) {
    toast.warning('请选择结账日期');
    return;
  }
  const res: any = await doCheckout(checkDate.value);
  toast.success(`结账成功，快照 ${pick(res)?.snapshotted ?? 0} 个商品`);
  await loadCheckoutStatus();
}

/** 反结账 */
async function runUndo() {
  if (!(await confirm('确定要反结账吗？将删除最后一次结账记录。', '反结账确认'))) return;
  await undoCheckout();
  toast.success('反结账成功');
  await loadCheckoutStatus();
}

/* ---------------- 初始化 ---------------- */
const initConfirm = ref('');

/** 执行系统初始化（危险操作，需口令 + 二次确认） */
async function runInit() {
  if (initConfirm.value !== 'INITIALIZE') {
    toast.warning('请输入确认口令 INITIALIZE');
    return;
  }
  if (!(await confirm('此操作将清空全部业务数据且不可恢复，确定继续吗？', '危险操作'))) return;
  await initialization();
  toast.success('系统初始化完成');
}

/** 按当前 type 加载对应面板的数据（init 无需加载） */
function loadByType(t: string) {
  if (t === 'mrp') void loadMrpRows();
  else if (t === 'replenishment') void loadReplenishment();
  else if (t === 'sold') void loadSold();
  else if (t === 'wages') void loadWages();
  else if (t === 'checkout') void loadCheckoutStatus();
}

onMounted(() => loadByType(type.value));

/**
 * 系统初始化 / 结账 / MRP … 都挂在 /special/:type 下。
 * 它们之间互相切换时 Vue 会复用同一组件实例，type 不会自动重算，
 * 导致页面内容「切不过去」。这里监听路由参数变化，主动更新 type 并重载数据。
 */
watch(
  () => route.params.type,
  (t) => {
    type.value = String(t || '');
    loadByType(type.value);
  },
);
</script>

<script lang="ts">
export default { name: 'SpecialView' };
</script>

<style scoped>
.special {
  padding: 2px;
}
.danger-link { color: var(--ds-danger); }
</style>
