<template>
  <div class="bom">
    <DsTabs v-model="tab" :items="tabItems" />

    <!-- ============ BOM 清单 ============ -->
    <div v-if="tab === 'bom'" class="layout">
      <div class="left">
        <div class="toolbar">
          <DsInput v-model="bomSearch" placeholder="编号/名称/商品" style="width: 180px" clearable @clear="loadBoms" @keyup.enter="loadBoms" />
          <DsButton variant="primary" @click="loadBoms">查询</DsButton>
          <DsButton @click="newBom">新增清单</DsButton>
        </div>
        <DsTable :columns="bomCols" :data="bomRows" clickable striped :height="520" @row-click="onBomRow">
          <template #act="{ row }">
            <DsButton variant="text" size="sm" class="danger-link" @click.stop="removeBom(row)">删除</DsButton>
          </template>
        </DsTable>
      </div>

      <div class="right" v-if="bomForm">
        <div class="form-bar">
          <DsField label="清单编号"><DsInput v-model="bomForm.purchase_code" /></DsField>
          <DsField label="清单名称"><DsInput v-model="bomForm.name" /></DsField>
          <DsField label="商品编号"><DsInput v-model="bomForm.goods_code" /></DsField>
          <DsField label="商品名称"><DsInput v-model="bomForm.goods_name" /></DsField>
          <DsField label="计件工资"><DsInput v-model="bomForm.wages" type="number" :step="0.0001" /></DsField>
        </div>

        <div class="detail-head">
          <span>物料明细</span>
          <DsButton size="sm" variant="primary" @click="addBomMat">+ 增行</DsButton>
        </div>
        <DsTable :columns="matCols" :data="bomMaterials" :height="300">
          <template #goods_code="{ row }">
            <DsSelect
              v-model="row.goods_code"
              :options="goodsOptions.map((g) => ({ label: `${g.goods_code} ${g.goods_name}`, value: g.goods_code }))"
              remote
              filterable
              placeholder="选择商品"
              @search="(kw: string) => goodsSearch(kw)"
              @change="(v: string) => onGoodsChange(v, row)"
            />
          </template>
          <template #goods_name="{ row }"><DsInput v-model="row.goods_name" /></template>
          <template #unit_id="{ row }"><DsInput v-model="row.unit_id" /></template>
          <template #purchase="{ row }"><DsInput v-model="row.purchase" type="number" :step="0.0001" /></template>
          <template #number="{ row }"><DsInput v-model="row.number" type="number" :step="0.0001" @change="calcMat(row)" /></template>
          <template #money="{ row }"><DsInput v-model="row.money" type="number" :step="0.01" /></template>
          <template #remark="{ row }"><DsInput v-model="row.remark" /></template>
          <template #act="{ index }">
            <DsButton variant="text" size="sm" class="danger-link" @click="bomMaterials.splice(index, 1)">删</DsButton>
          </template>
        </DsTable>
        <div class="foot">
          <span>合计数量：<b>{{ bomTotalNumber }}</b></span>
          <span>合计金额：<b>{{ bomTotalMoney }}</b></span>
          <DsButton variant="primary" @click="saveBom">保存清单</DsButton>
        </div>
      </div>
      <DsEmpty v-else title="请选择或新增一个 BOM 清单" class="right" />
    </div>

    <!-- ============ 工序 ============ -->
    <div v-else class="layout">
      <div class="left">
        <div class="toolbar">
          <DsSelect
            v-model="procBomId"
            :options="bomRows.map((b) => ({ label: `${b.purchase_code} ${b.name}`, value: b.id }))"
            placeholder="先选 BOM 清单"
            style="width: 220px"
            @change="loadProcs"
          />
          <DsButton :disabled="!procBomId" @click="newProc">新增工序</DsButton>
        </div>
        <DsTable :columns="procCols" :data="procRows" clickable striped :height="520" @row-click="onProcRow">
          <template #act="{ row }">
            <DsButton variant="text" size="sm" class="danger-link" @click.stop="removeProc(row)">删除</DsButton>
          </template>
        </DsTable>
      </div>

      <div class="right" v-if="procForm">
        <div class="form-bar">
          <DsField label="工序编号"><DsInput v-model="procForm.purchase_code" /></DsField>
          <DsField label="工序名称"><DsInput v-model="procForm.name" /></DsField>
          <DsField label="车间">
            <DsSelect
              v-model="procForm.workshop_id"
              :options="workshopOptions.map((w) => ({ label: w.name, value: w.id }))"
              filterable
              placeholder="选择车间"
            />
          </DsField>
          <DsField label="单位工资"><DsInput v-model="procForm.wages" type="number" :step="0.0001" /></DsField>
          <DsField label="标准工时"><DsInput v-model="procForm.hours" type="number" :step="0.01" /></DsField>
        </div>

        <div class="detail-head">
          <span>工序物料明细</span>
          <DsButton size="sm" variant="primary" @click="addProcMat">+ 增行</DsButton>
        </div>
        <DsTable :columns="matCols" :data="procMaterials" :height="300">
          <template #goods_code="{ row }">
            <DsSelect
              v-model="row.goods_code"
              :options="goodsOptions.map((g) => ({ label: `${g.goods_code} ${g.goods_name}`, value: g.goods_code }))"
              remote
              filterable
              placeholder="选择商品"
              @search="(kw: string) => goodsSearch(kw)"
              @change="(v: string) => onGoodsChange(v, row)"
            />
          </template>
          <template #goods_name="{ row }"><DsInput v-model="row.goods_name" /></template>
          <template #unit_id="{ row }"><DsInput v-model="row.unit_id" /></template>
          <template #purchase="{ row }"><DsInput v-model="row.purchase" type="number" :step="0.0001" /></template>
          <template #number="{ row }"><DsInput v-model="row.number" type="number" :step="0.0001" @change="calcMat(row)" /></template>
          <template #money="{ row }"><DsInput v-model="row.money" type="number" :step="0.01" /></template>
          <template #remark="{ row }"><DsInput v-model="row.remark" /></template>
          <template #act="{ index }">
            <DsButton variant="text" size="sm" class="danger-link" @click="procMaterials.splice(index, 1)">删</DsButton>
          </template>
        </DsTable>
        <div class="foot">
          <span>合计数量：<b>{{ procTotalNumber }}</b></span>
          <span>合计金额：<b>{{ procTotalMoney }}</b></span>
          <DsButton variant="primary" @click="saveProc">保存工序</DsButton>
        </div>
      </div>
      <DsEmpty v-else title="请选择 BOM 清单并新增 / 选择工序" class="right" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@/components/ds/toast';
import { confirm } from '@/components/ds/useConfirm';
import * as api from '../api/bom';
import { selectpage } from '../api/dynamic';

const route = useRoute();
const toast = useToast();
const tab = ref<'bom' | 'procedure'>(
  String(route.query.tab) === 'procedure' ? 'procedure' : 'bom',
);

/** 页签配置 */
const tabItems = [
  { label: 'BOM 清单', value: 'bom' },
  { label: '生产工序', value: 'procedure' },
];

/* ---------------- 列配置 ---------------- */
/** BOM 清单表列 */
const bomCols = [
  { title: '编号', key: 'purchase_code', width: '140px' },
  { title: '清单名称', key: 'name' },
  { title: '商品', key: 'goods_name' },
  { title: '数量', key: 'number', width: '90px' },
  { title: '金额', key: 'all_money', width: '100px' },
  { title: '操作', key: 'act', width: '70px', slot: true },
];

/** 工序表列 */
const procCols = [
  { title: '工序编号', key: 'purchase_code', width: '140px' },
  { title: '工序名称', key: 'name' },
  { title: '车间', key: 'workshop_name', width: '120px' },
  { title: '单位工资', key: 'wages', width: '90px' },
  { title: '标准工时', key: 'hours', width: '90px' },
  { title: '操作', key: 'act', width: '70px', slot: true },
];

/** 物料明细表列（BOM / 工序共用，全部为可编辑插槽列） */
const matCols = [
  { title: '商品编号', key: 'goods_code', width: '160px', slot: true },
  { title: '商品名称', key: 'goods_name', width: '140px', slot: true },
  { title: '单位', key: 'unit_id', width: '90px', slot: true },
  { title: '进价', key: 'purchase', width: '100px', slot: true },
  { title: '数量', key: 'number', width: '100px', slot: true },
  { title: '金额', key: 'money', width: '100px', slot: true },
  { title: '备注', key: 'remark', minWidth: '120px', slot: true },
  { title: '', key: 'act', width: '50px', slot: true },
];

/* ---------------- 公共：商品 / 车间 选项 ---------------- */
const goodsOptions = ref<any[]>([]);
const workshopOptions = ref<any[]>([]);
async function loadWorkshops() {
  const res: any = await selectpage('kuyou_workshop', { offset: 0, limit: 200 });
  workshopOptions.value = res.rows || [];
}
async function goodsSearch(kw: string) {
  const res: any = await selectpage('kuyou_goods', { offset: 0, limit: 50, search: kw || '' });
  goodsOptions.value = res.rows || [];
}
function onGoodsChange(code: string, row: any) {
  const g = goodsOptions.value.find((x) => x.goods_code === code);
  if (g) {
    row.goods_name = g.goods_name;
    row.goods_code = g.goods_code;
    if (g.unit_id !== undefined) row.unit_id = g.unit_id;
  }
}

/* ---------------- BOM 清单 ---------------- */
const bomSearch = ref('');
const bomRows = ref<any[]>([]);
const bomForm = ref<any>(null);
const bomMaterials = ref<any[]>([]);
async function loadBoms() {
  const res: any = await api.listBom({ page: 1, limit: 200, search: bomSearch.value });
  bomRows.value = res.rows || [];
}
async function onBomRow(row: any) {
  if (!row) return;
  const res: any = await api.getBom(row.id);
  bomForm.value = res.header || {};
  bomMaterials.value = (res.materials || []).map((m: any) => ({ ...m }));
}
function newBom() {
  bomForm.value = { purchase_code: '', name: '', goods_code: '', goods_name: '', wages: 0 };
  bomMaterials.value = [];
}
function addBomMat() {
  bomMaterials.value.push({ goods_code: '', goods_name: '', unit_id: '', purchase: 0, number: 0, money: 0, remark: '' });
}
function calcMat(row: any) {
  row.money = Math.round((Number(row.purchase) || 0) * (Number(row.number) || 0) * 100) / 100;
}
const bomTotalNumber = computed(() => bomMaterials.value.reduce((s: number, r: any) => s + (Number(r.number) || 0), 0).toFixed(4));
const bomTotalMoney = computed(() => bomMaterials.value.reduce((s: number, r: any) => s + (Number(r.money) || 0), 0).toFixed(2));
async function saveBom() {
  if (!bomMaterials.value.length) return toast.warning('请填写物料明细');
  const res: any = await api.saveBom({ header: bomForm.value, materials: bomMaterials.value });
  toast.success(res.mode === 'edit' ? '更新成功' : '新增成功');
  await loadBoms();
}
async function removeBom(row: any) {
  if (!(await confirm('确认删除该 BOM 清单及其全部工序？', '提示'))) return;
  await api.delBom(row.id);
  toast.success('已删除');
  await loadBoms();
}

/* ---------------- 工序 ---------------- */
const procBomId = ref<number | string>('');
const procRows = ref<any[]>([]);
const procForm = ref<any>(null);
const procMaterials = ref<any[]>([]);
async function loadProcs() {
  if (!procBomId.value) { procRows.value = []; return; }
  const res: any = await api.listProcedure({ bomId: procBomId.value });
  procRows.value = res.rows || [];
}
async function onProcRow(row: any) {
  if (!row) return;
  const res: any = await api.getProcedure(row.id);
  procForm.value = res.header || {};
  procMaterials.value = (res.materials || []).map((m: any) => ({ ...m }));
}
function newProc() {
  if (!procBomId.value) return toast.warning('请先选择 BOM 清单');
  procForm.value = { purchase_code: '', name: '', workshop_id: '', wages: 0, hours: 0, bom_id: procBomId.value, remark: '' };
  procMaterials.value = [];
}
function addProcMat() {
  procMaterials.value.push({ goods_code: '', goods_name: '', unit_id: '', purchase: 0, number: 0, money: 0, remark: '' });
}
const procTotalNumber = computed(() => procMaterials.value.reduce((s: number, r: any) => s + (Number(r.number) || 0), 0).toFixed(4));
const procTotalMoney = computed(() => procMaterials.value.reduce((s: number, r: any) => s + (Number(r.money) || 0), 0).toFixed(2));
async function saveProc() {
  if (!procMaterials.value.length) return toast.warning('请填写工序物料明细');
  const res: any = await api.saveProcedure({ header: procForm.value, materials: procMaterials.value });
  toast.success(res.mode === 'edit' ? '更新成功' : '新增成功');
  await loadProcs();
}
async function removeProc(row: any) {
  if (!(await confirm('确认删除该工序及其物料？', '提示'))) return;
  await api.delProcedure(row.id);
  toast.success('已删除');
  await loadProcs();
}

onMounted(async () => {
  await Promise.all([loadBoms(), loadWorkshops(), goodsSearch('')]);
});
</script>

<style scoped>
.bom {
  background: var(--ds-bg-elevated);
  padding: 14px;
  border-radius: var(--ds-radius-md);
  border: 1px solid var(--ds-border);
}
.layout { display: flex; gap: 14px; }
.left { width: 460px; flex: none; }
.right { flex: 1; border-left: 1px solid var(--ds-border); padding-left: 14px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 10px; }
/* 右栏宽度有限，字段最小列宽收到 170px，保证两列并排不挤 */
.right .form-bar { --filter-min: 170px; }
.detail-head { display: flex; justify-content: space-between; align-items: center; margin: 10px 0 6px; font-weight: 600; }
.foot { display: flex; gap: 20px; align-items: center; margin-top: 12px; }
.foot b { color: var(--ds-danger); }
.danger-link { color: var(--ds-danger); }
</style>
