<!-- src/views/prefix.vue -->
<script setup lang="ts">
/**
 * 单据编号规则
 *
 * 源系统 kuyou_prefix 表存的是「前缀 + 日期段开关 + 流水号」的编号生成规则，
 * 裸表 CRUD 看不出规则含义，所以这里做成专用页：
 *  - 列表把 6 个日期开关合成「年/月/日/时/分/秒」标签
 *  - 编辑弹窗按规则实时预览生成的编号示例
 *
 * 字段时间位取值：1=启用该时间单位，2=不启用（源 schema enum('1','2') 默认 '1'）。
 *
 * 路由：/prefix
 */
import { ref, computed, onMounted } from 'vue';
import { useToast } from '@/components/ds/toast';
import * as api from '../api/dynamic';

const toast = useToast();

/** 日期段字段与中文名（顺序即编号拼接顺序） */
const DATE_PARTS: { prop: string; label: string; fmt: (d: Date) => string }[] = [
  { prop: 'year', label: '年', fmt: (d) => String(d.getFullYear()) },
  { prop: 'month', label: '月', fmt: (d) => String(d.getMonth() + 1).padStart(2, '0') },
  { prop: 'day', label: '日', fmt: (d) => String(d.getDate()).padStart(2, '0') },
  { prop: 'hour', label: '时', fmt: (d) => String(d.getHours()).padStart(2, '0') },
  { prop: 'minute', label: '分', fmt: (d) => String(d.getMinutes()).padStart(2, '0') },
  { prop: 'second', label: '秒', fmt: (d) => String(d.getSeconds()).padStart(2, '0') },
];

const loading = ref(false);
const saving = ref(false);
const rows = ref<any[]>([]);

/** 加载全部编号规则 */
async function load() {
  loading.value = true;
  try {
    const res: any = await api.list('kuyou_prefix', { limit: 300, sort: 'type', order: 'asc' });
    rows.value = res.rows || [];
  } catch (e: any) {
    toast.error(e?.response?.data?.msg || e?.message || '编号规则加载失败');
  } finally {
    loading.value = false;
  }
}

/**
 * 该规则启用的日期段标签
 * @param row 规则行
 * @returns 形如 ['年','月','日'] 的标签数组
 */
function partsOf(row: any): string[] {
  return DATE_PARTS.filter((p) => Number(row[p.prop]) === 1).map((p) => p.label);
}

/**
 * 按规则生成编号示例
 *
 * 拼接顺序：前缀 → 启用的日期段 → 流水号（按 strlen 左补零）。
 *
 * @param row 规则行
 * @returns 示例编号字符串
 */
function preview(row: any): string {
  const now = new Date();
  let s = String(row.prefix || '');
  for (const p of DATE_PARTS) if (Number(row[p.prop]) === 1) s += p.fmt(now);
  const len = Number(row.strlen) || 0;
  const start = Number(row.start) || 1;
  s += len > 0 ? String(start).padStart(len, '0') : String(start);
  return s;
}

/** 列表列配置 */
const columns = computed(() => [
  { title: '#', key: '__idx', width: '56px', formatter: (_v: any, _r: any, i: number) => i + 1 },
  { title: '单据', key: 'name', width: '140px', slot: true },
  { title: '前缀', key: 'prefix', width: '100px', slot: true },
  { title: '日期段', key: '__parts', minWidth: '180px', slot: true },
  { title: '流水号', key: '__serial', width: '140px', slot: true },
  { title: '示例', key: '__example', minWidth: '200px', slot: true },
  { title: '目标表', key: 'dbname', minWidth: '180px', slot: true },
  { title: '操作', key: '__op', width: '90px', fixed: 'right' as const, slot: true },
]);

/* ---------------- 编辑 ---------------- */

const editVisible = ref(false);
const form = ref<any>({});

/**
 * 打开编辑：拷贝一份副本，取消时不污染列表
 * @param row 规则行
 * @returns 无
 */
function openEdit(row: any) {
  form.value = { ...row };
  editVisible.value = true;
}

/**
 * 切换某个日期段的启用状态
 * @param prop 字段名（year/month/...）
 * @returns 无
 */
function togglePart(prop: string) {
  form.value[prop] = Number(form.value[prop]) === 1 ? '2' : '1';
}

/** 保存当前规则 */
async function save() {
  const f = form.value;
  if (!String(f.prefix || '').trim()) {
    toast.warning('请填写单据前缀');
    return;
  }
  if (Number(f.strlen) <= 0) {
    toast.warning('流水号长度必须大于 0');
    return;
  }
  saving.value = true;
  try {
    await api.edit('kuyou_prefix', {
      ...f,
      start: Number(f.start) || 1,
      strlen: Number(f.strlen) || 3,
      example: preview(f),
    });
    toast.success('保存成功');
    editVisible.value = false;
    load();
  } catch (e: any) {
    toast.error(e?.response?.data?.msg || e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="prefix-page">
    <DsCard>
      <template #title>
        <div class="toolbar">
          <span class="title">单据编号规则</span>
          <div class="grow" />
          <DsButton @click="load">刷新</DsButton>
        </div>
      </template>

      <DsTable :columns="columns" :data="rows" :loading="loading" striped row-key="id">
        <template #name="{ row }">{{ row.name }}</template>
        <template #prefix="{ row }">
          <code class="prefix-code">{{ row.prefix }}</code>
        </template>
        <template #__parts="{ row }">
          <span v-if="!partsOf(row).length" class="muted">无日期段</span>
          <DsTag v-for="p in partsOf(row)" v-else :key="p" color="neutral" size="sm" style="margin-right: 4px">{{ p }}</DsTag>
        </template>
        <template #__serial="{ row }">
          {{ Number(row.start) || 1 }} 起 · {{ Number(row.strlen) || 0 }} 位
        </template>
        <template #__example="{ row }">
          <code class="example">{{ preview(row) }}</code>
        </template>
        <template #dbname="{ row }">
          <span class="muted">{{ row.dbname }}<template v-if="row.field">.{{ row.field }}</template></span>
        </template>
        <template #__op="{ row }">
          <DsButton variant="text" size="sm" @click="openEdit(row)">编辑</DsButton>
        </template>
      </DsTable>

      <DsEmpty v-if="!loading && !rows.length" title="暂无编号规则" description="请先执行 db/seed-settings.sql 初始化单据编号规则" />
    </DsCard>

    <!-- 编辑弹窗：前缀 + 日期段开关 + 流水号，底部实时预览 -->
    <DsModal v-model="editVisible" :title="`编号规则 · ${form.name || ''}`" :width="620">
      <div class="form">
        <DsField label="单据前缀" required>
          <DsInput v-model="form.prefix" placeholder="如 GHD" style="width: 100%" />
        </DsField>

        <DsField label="包含日期段">
          <div class="parts">
            <DsCheckbox
              v-for="p in DATE_PARTS"
              :key="p.prop"
              :model-value="Number(form[p.prop]) === 1"
              size="sm"
              @change="() => togglePart(p.prop)"
            >
              {{ p.label }}
            </DsCheckbox>
          </div>
        </DsField>

        <DsField label="流水号起始">
          <DsInput v-model="form.start" type="number" :min="1" style="width: 100%" />
        </DsField>

        <DsField label="流水号位数">
          <DsInput v-model="form.strlen" type="number" :min="1" style="width: 100%" />
        </DsField>

        <DsField label="目标表">
          <DsInput v-model="form.dbname" disabled style="width: 100%" />
        </DsField>

        <DsField label="目标字段">
          <DsInput v-model="form.field" disabled style="width: 100%" />
        </DsField>
      </div>

      <div class="preview">
        <span class="preview-label">编号示例</span>
        <code class="preview-code">{{ preview(form) }}</code>
      </div>

      <template #footer>
        <DsButton @click="editVisible = false">取消</DsButton>
        <DsButton variant="primary" :loading="saving" @click="save">保存</DsButton>
      </template>
    </DsModal>
  </div>
</template>

<style scoped>
.prefix-page {
  padding: 12px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
}
.title {
  font-size: 15px;
  font-weight: 600;
}
.grow {
  flex: 1;
}
.prefix-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--ds-bg-subtle, rgba(0, 0, 0, 0.04));
  color: var(--ds-text);
}
.example {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--ds-primary, #4d6bfe);
}
.muted {
  color: var(--ds-text-2);
  font-size: 12px;
}
.form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 16px;
}
.parts {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  min-height: 32px;
  align-items: center;
}
.preview {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  padding: 10px 12px;
  border: 1px dashed var(--ds-border);
  border-radius: var(--ds-radius-md);
  background: var(--ds-bg);
}
.preview-label {
  font-size: 12px;
  color: var(--ds-text-2);
}
.preview-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--ds-primary, #4d6bfe);
}
</style>
