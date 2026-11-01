<!-- src/views/settings.vue -->
<script setup lang="ts">
/**
 * 系统设置 / 用户设置
 *
 * 源系统这两个页面不是「表 CRUD」，而是把 kuyou_sets / kuyou_user_sets 里的
 * 键值配置项渲染成表单，一次提交修改。配置项语义：
 *  - type=1 基础参数：只有 value，如公司名称、启用时间、小数位数
 *  - type=2 功能参数：value 存附加参数（税率等）+ is_checked 存开关状态
 *  - type=3 其他    ：价格策略等，语义同 1
 *  - is_edit=1 表示该参数启用后不允许再改（源端灰显处理）
 *
 * 路由：/settings/system（系统设置）、/settings/user（用户设置）
 */
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@/components/ds/toast';
import * as api from '../api/dynamic';

const route = useRoute();
const toast = useToast();

/** 路由参数 → 配置表 */
const TABLE_OF: Record<string, string> = {
  system: 'kuyou_sets',
  user: 'kuyou_user_sets',
};

/** 当前配置表 */
const table = computed(() => TABLE_OF[String(route.params.kind || 'system')] || 'kuyou_sets');

/** 页面标题 */
const title = computed(() => (String(route.params.kind) === 'user' ? '用户设置' : '系统设置'));

/** type → 分组名（源 system 设置的三类参数） */
const GROUP_LABEL: Record<string, string> = {
  '1': '基础参数',
  '2': '功能参数',
  '3': '价格与策略',
};

/** 数值型参数：用 number 输入框，避免录入非数字 */
const NUMBER_NAMES = new Set(['price_decimal', 'number_decimal', 'taxes']);

const loading = ref(false);
const saving = ref(false);
const rows = ref<any[]>([]);

/** 编辑草稿：配置项 id → { value, checked } */
interface Draft {
  value: string;
  checked: boolean;
}
const draft = reactive<Record<string, Draft>>({});

/**
 * 加载配置项
 * 一次性拉全量（配置项不超过百条），前端按 type 分组渲染。
 * @returns 无
 */
async function load() {
  loading.value = true;
  try {
    const res: any = await api.list(table.value, { limit: 300, sort: 'id', order: 'asc' });
    rows.value = res.rows || [];
    // 重建草稿：value 统一转字符串，checked 由 is_checked 的 0/1 转布尔
    Object.keys(draft).forEach((k) => delete draft[k]);
    for (const r of rows.value) {
      draft[String(r.id)] = {
        value: r.value === null || r.value === undefined ? '' : String(r.value),
        checked: Number(r.is_checked) === 1,
      };
    }
  } catch (e: any) {
    toast.error(e?.response?.data?.msg || e?.message || '配置加载失败');
  } finally {
    loading.value = false;
  }
}

/** 按 type 分组后的配置项 */
const groups = computed(() => {
  const map = new Map<string, any[]>();
  for (const r of rows.value) {
    const t = String(r.type ?? '1');
    if (!map.has(t)) map.set(t, []);
    map.get(t)!.push(r);
  }
  return Array.from(map, ([type, list]) => ({
    type,
    label: GROUP_LABEL[type] || `其他参数`,
    rows: list,
    /** type=2 的功能参数带开关 */
    toggle: type === '2',
  }));
});

/**
 * 该项是否需要值输入框
 *
 * 功能参数（type=2）里只有带附加值的项才显示输入框，
 * 例如「启用税金」需要填税率，而「启用审核」只有一个开关。
 *
 * @param r 配置项
 * @returns 需要输入框返回 true
 */
function hasValue(r: any): boolean {
  if (String(r.type) === '2') return NUMBER_NAMES.has(r.name) || (r.value !== null && r.value !== '');
  return true;
}

/**
 * 是否数值输入
 * @param name 变量名
 * @returns 数值型返回 true
 */
function isNumberName(name: string): boolean {
  return NUMBER_NAMES.has(name);
}

/**
 * 是否存在未保存的改动
 *
 * 注意：数值项走 DsInput type="number"，组件会把值转成 Number 后再 emit，
 * 而原始值 r.value 来自后端是字符串。两边类型不同必须统一转字符串比较，
 * 否则 `5 !== '5'` 恒为真，数值项会一直停留在「待保存」状态。
 */
const dirty = computed(() => {
  return rows.value.filter((r) => {
    const d = draft[String(r.id)];
    if (!d) return false;
    const v0 = r.value === null || r.value === undefined ? '' : String(r.value);
    const v1 = d.value === null || d.value === undefined ? '' : String(d.value);
    const c0 = Number(r.is_checked) === 1;
    return v1 !== v0 || d.checked !== c0;
  });
});

/**
 * 保存全部改动
 *
 * 逐条提交（后端只有单条 edit 接口），并行发出以减少等待；
 * 有任何一条失败都汇总提示，成功的也会保留。
 *
 * @returns 无
 */
async function saveAll() {
  const list = dirty.value;
  if (!list.length) {
    toast.info('没有需要保存的改动');
    return;
  }
  saving.value = true;
  let ok = 0;
  const errs: string[] = [];
  await Promise.all(
    list.map(async (r) => {
      const d = draft[String(r.id)];
      try {
        await api.edit(table.value, {
          ...r,
          value: d.value,
          is_checked: d.checked ? 1 : 0,
        });
        ok += 1;
      } catch (e: any) {
        errs.push(`${r.nickname}：${e?.response?.data?.msg || e?.message || '保存失败'}`);
      }
    }),
  );
  saving.value = false;
  if (ok) toast.success(`已保存 ${ok} 项设置`);
  if (errs.length) toast.error(`${errs.length} 项失败：${errs[0]}`);
  await load();
}

watch(table, () => load());
onMounted(load);
</script>

<template>
  <div class="settings-page">
    <DsCard>
      <template #title>
        <div class="toolbar">
          <span class="title">{{ title }}</span>
          <div class="grow" />
          <span v-if="dirty.length" class="dirty">{{ dirty.length }} 项待保存</span>
          <DsButton @click="load">刷新</DsButton>
          <DsButton variant="primary" :loading="saving" :disabled="!dirty.length" @click="saveAll">保存</DsButton>
        </div>
      </template>

      <DsEmpty
        v-if="!loading && !rows.length"
        title="暂无配置项"
        description="请先执行 db/seed-settings.sql 初始化系统设置数据"
      />

      <div v-else class="groups">
        <section v-for="g in groups" :key="g.type" class="group">
          <h3 class="group-title">{{ g.label }}</h3>
          <div class="grid">
            <div v-for="r in g.rows" :key="r.id" class="item">
              <div class="item-head">
                <span class="item-name">{{ r.nickname || r.name }}</span>
                <DsTag v-if="r.is_edit === '1'" color="warning" size="sm">启用后不可改</DsTag>
              </div>
              <div class="item-body">
                <DsCheckbox
                  v-if="g.toggle"
                  :model-value="draft[String(r.id)]?.checked ?? false"
                  :disabled="r.is_edit === '1'"
                  size="sm"
                  @change="(v: any) => (draft[String(r.id)].checked = v === true)"
                />
                <DsInput
                  v-if="hasValue(r)"
                  v-model="draft[String(r.id)].value"
                  :type="isNumberName(r.name) ? 'number' : 'text'"
                  :disabled="r.is_edit === '1'"
                  size="sm"
                  style="width: 100%"
                />
              </div>
              <p v-if="r.explain || r.notice" class="hint">{{ r.explain || r.notice }}</p>
            </div>
          </div>
        </section>
      </div>
    </DsCard>
  </div>
</template>

<style scoped>
.settings-page {
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
.dirty {
  font-size: 12px;
  color: var(--ds-warning, #d97706);
}
.groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ds-text);
  margin: 0 0 10px;
  padding-left: 8px;
  border-left: 3px solid var(--ds-primary, #4d6bfe);
  line-height: 1.2;
}
/* 配置项栅格：宽屏自动多列（每列 ≥240px），窄屏自动单列 */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px 18px;
}
.item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--ds-border);
  border-radius: var(--ds-radius-md);
  background: var(--ds-bg);
}
.item-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.item-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--ds-text-2);
}
.item-body {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ds-text-2);
}
</style>
