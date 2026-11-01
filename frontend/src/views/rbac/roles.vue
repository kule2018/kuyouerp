<template>
  <div class="rbac">
    <DsCard class="left" title="角色列表">
      <template #extra>
        <DsButton size="sm" variant="primary" @click="newRole">新建角色</DsButton>
      </template>
      <DsInput v-model="roleKw" size="sm" placeholder="搜索角色名称 / 标识" style="margin-bottom: 8px" />
      <div class="role-list">
        <div
          v-for="r in filteredRoles"
          :key="r.id"
          class="role-item"
          :class="{ active: current?.id === r.id }"
          @click="selectRole(r)"
        >
          <div class="role-name">{{ r.name }} <span class="role-code">{{ r.code }}</span></div>
          <div class="role-meta">
            <DsTag v-if="r.dataScope === 'all'" size="sm">全部数据</DsTag>
            <DsTag v-else size="sm" type="warning">按仓库</DsTag>
            <DsTag size="sm" :type="r.status === 'normal' ? 'success' : 'danger'">{{ r.status }}</DsTag>
          </div>
          <DsButton
            v-permission="'rbac:role:delete'"
            size="sm"
            variant="text"
            class="danger-link"
            @click.stop="delRole(r)"
          >删除</DsButton>
        </div>
      </div>
    </DsCard>

    <DsCard class="right" :title="current ? `编辑角色：${current.name}` : '新建角色'">
      <div v-if="!current && !creating" class="empty">请选择左侧角色，或点击「新建角色」</div>
      <div v-else class="editor">
        <div class="form-row">
          <DsField label="角色名称" required><DsInput v-model="form.name" placeholder="如 仓库管理员" /></DsField>
          <DsField label="角色标识" required><DsInput v-model="form.code" placeholder="如 store_admin" :disabled="!!current" /></DsField>
        </div>
        <div class="form-row">
          <DsField label="状态">
            <DsSelect v-model="form.status" :options="[{label:'正常',value:'normal'},{label:'禁用',value:'hidden'}]" />
          </DsField>
          <DsField label="排序"><DsInput v-model="form.sort" type="number" /></DsField>
        </div>
        <div class="form-row">
          <DsField label="数据权限">
            <DsSelect v-model="form.dataScope" :options="[{label:'全部数据',value:'all'},{label:'仅授权仓库',value:'custom'}]" />
          </DsField>
          <DsField v-if="form.dataScope === 'custom'" label="授权仓库">
            <DsSelect v-model="form.stores" multiple :options="storeOptions" placeholder="选择可访问仓库" />
          </DsField>
        </div>
        <DsField label="备注"><DsInput v-model="form.remark" /></DsField>

        <DsTabs v-model="tab" :items="[{label:'菜单权限',value:'menu'},{label:'按钮权限',value:'button'},{label:'系统权限',value:'sys'}]" />
        <DsInput v-model="permKw" size="sm" placeholder="筛选权限项（名称 / 编码）" style="margin: 8px 0" />

        <!-- 菜单权限 -->
        <div v-show="tab === 'menu'" class="perm-tree">
          <label v-for="n in filteredFlatMenus" :key="n.label + n.depth" class="perm-row" :style="{ paddingLeft: n.depth * 16 + 'px' }">
            <template v-if="n.code">
              <input type="checkbox" v-model="checked[n.code]" /> {{ n.label }}
              <span class="perm-code">{{ n.code }}</span>
            </template>
            <template v-else><b>{{ n.label }}</b></template>
          </label>
          <div v-if="!filteredFlatMenus.length" class="perm-empty">无匹配权限</div>
        </div>

        <!-- 按钮权限 -->
        <div v-show="tab === 'button'" class="perm-matrix">
          <div v-for="t in filteredTables" :key="t" class="matrix-row">
            <span class="matrix-table">{{ t }}</span>
            <label v-for="a in actions" :key="a" class="chk"><input type="checkbox" v-model="checked[`button:${t}:${a}`]" /> {{ labelOf(a) }}</label>
          </div>
          <div v-if="!filteredTables.length" class="perm-empty">无匹配权限</div>
        </div>

        <!-- 系统权限 -->
        <div v-show="tab === 'sys'" class="perm-tree">
          <label v-for="p in filteredSysPerms" :key="p.code" class="perm-row">
            <input type="checkbox" v-model="checked[p.code]" /> {{ p.label }}
            <span class="perm-code">{{ p.code }}</span>
          </label>
          <div v-if="!filteredSysPerms.length" class="perm-empty">无匹配权限</div>
        </div>

        <div class="footer">
          <DsButton @click="cancel">取消</DsButton>
          <DsButton variant="primary" :loading="saving" @click="save">保存</DsButton>
        </div>
      </div>
    </DsCard>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue';
import request from '../../utils/request';
import { MENU_ITEMS, permOf } from '../../config/menu';
import { useToast } from '@/components/ds/toast';
import { confirm } from '@/components/ds/useConfirm';

const toast = useToast();
const roles = ref<any[]>([]);
/** 角色搜索过滤 */
const roleKw = ref('');
const filteredRoles = computed(() => {
  const k = roleKw.value.trim().toLowerCase();
  if (!k) return roles.value;
  return roles.value.filter(
    (r) => (r.name || '').toLowerCase().includes(k) || (r.code || '').toLowerCase().includes(k),
  );
});
const current = ref<any>(null);
const creating = ref(false);
const saving = ref(false);
const tab = ref('menu');

const form = reactive({
  name: '', code: '', status: 'normal', sort: 0, dataScope: 'all', remark: '',
  stores: [] as number[],
});
const checked = reactive<Record<string, boolean>>({});

// ---- 权限目录 ----
interface FlatNode { label: string; code: string | null; depth: number; }
function flatten(items: any[], depth = 0, out: FlatNode[] = []): FlatNode[] {
  for (const it of items) {
    const code = it.children?.length ? null : permOf(it.to);
    out.push({ label: it.label, code, depth });
    if (it.children) flatten(it.children, depth + 1, out);
  }
  return out;
}
const flatMenus = flatten(MENU_ITEMS);

const tables = (() => {
  const set = new Set<string>();
  const walk = (items: any[]) => {
    for (const it of items) {
      if (it.children) walk(it.children);
      else {
        const m = (it.to || '').match(/^\/(crud|doc|report)\/([^?]+)/);
        if (m) set.add(m[2]);
      }
    }
  };
  walk(MENU_ITEMS);
  return [...set];
})();
const actions = ['add', 'edit', 'delete', 'import', 'export'];
const labelOf = (a: string) => ({ add: '新增', edit: '编辑', delete: '删除', import: '导入', export: '导出' }[a]);
const sysPerms = [
  { code: 'rbac:role:list', label: '角色-查看' },
  { code: 'rbac:role:create', label: '角色-新建' },
  { code: 'rbac:role:update', label: '角色-编辑' },
  { code: 'rbac:role:delete', label: '角色-删除' },
  { code: 'rbac:role:assign', label: '角色-分配权限/仓库' },
  { code: 'rbac:admin:list', label: '管理员-查看' },
  { code: 'rbac:admin:assign', label: '管理员-分配角色' },
];

/** 权限树筛选（菜单/按钮/系统三个 Tab 共用一个关键字） */
const permKw = ref('');
const filteredFlatMenus = computed(() => {
  const k = permKw.value.trim().toLowerCase();
  if (!k) return flatMenus;
  return flatMenus.filter(
    (n) => (n.label || '').toLowerCase().includes(k) || (n.code || '').toLowerCase().includes(k),
  );
});
const filteredSysPerms = computed(() => {
  const k = permKw.value.trim().toLowerCase();
  if (!k) return sysPerms;
  return sysPerms.filter(
    (p) => (p.label || '').toLowerCase().includes(k) || (p.code || '').toLowerCase().includes(k),
  );
});
const filteredTables = computed(() => {
  const k = permKw.value.trim().toLowerCase();
  if (!k) return tables;
  return tables.filter((t) => t.toLowerCase().includes(k));
});

const storeOptions = ref<any[]>([]);

async function loadRoles() {
  const data = await request({ url: 'rbac/roles', method: 'get' });
  roles.value = data?.data || [];
}
async function loadStores() {
  try {
    const d: any = await request({ url: '/kuyou_stores/index', method: 'get', params: { limit: 200 } });
    storeOptions.value = (d?.rows || []).map((s: any) => ({ label: s.name || `仓库${s.id}`, value: s.id }));
  } catch { storeOptions.value = []; }
}

function resetForm() {
  Object.assign(form, { name: '', code: '', status: 'normal', sort: 0, dataScope: 'all', remark: '', stores: [] });
  for (const k of Object.keys(checked)) delete checked[k];
}
function newRole() {
  current.value = null;
  creating.value = true;
  resetForm();
}
async function selectRole(r: any) {
  current.value = r;
  creating.value = false;
  const d = await request({ url: `rbac/roles/${r.id}`, method: 'get' });
  const det = d.data || {};
  Object.assign(form, {
    name: det.name, code: det.code, status: det.status, sort: det.sort, dataScope: det.dataScope,
    remark: det.remark || '', stores: det.stores || [],
  });
  for (const k of Object.keys(checked)) delete checked[k];
  for (const c of det.permissions || []) checked[c] = true;
}
function cancel() {
  current.value = null;
  creating.value = false;
  resetForm();
}

function collectCodes(): string[] {
  return Object.keys(checked).filter((k) => checked[k]);
}

async function save() {
  if (!form.name || !form.code) { toast.warning('请填写角色名称与标识'); return; }
  saving.value = true;
  try {
    let id = current.value?.id;
    if (!id) {
      const created = await request({ url: 'rbac/roles', method: 'post', data: { ...form } });
      id = created.data?.id;
      current.value = { id };
    } else {
      await request({ url: `rbac/roles/${id}`, method: 'put', data: { ...form } });
    }
    const codes = collectCodes();
    await request({ url: `rbac/roles/${id}/permissions`, method: 'post', data: { codes } });
    if (form.dataScope === 'custom') {
      await request({ url: `rbac/roles/${id}/stores`, method: 'post', data: { storeIds: form.stores || [] } });
    } else {
      await request({ url: `rbac/roles/${id}/stores`, method: 'post', data: { storeIds: [] } });
    }
    toast.success('已保存');
    await loadRoles();
  } finally {
    saving.value = false;
  }
}

async function delRole(r: any) {
  if (!(await confirm(`确认删除角色「${r.name}」？`, '提示'))) return;
  await request({ url: `rbac/roles/${r.id}`, method: 'delete' });
  toast.success('已删除');
  if (current.value?.id === r.id) cancel();
  await loadRoles();
}

onMounted(() => { loadRoles(); loadStores(); });
</script>

<style scoped>
.rbac { display: flex; gap: 12px; height: 100%; }
.left { width: 320px; flex: none; }
.right { flex: 1; min-width: 0; }
.role-list { display: flex; flex-direction: column; gap: 8px; }
.role-item {
  border: 1px solid var(--ds-border); border-radius: 8px; padding: 8px 10px; cursor: pointer;
  transition: all .15s;
}
.role-item.active { border-color: var(--ds-primary, #3a506b); background: var(--ds-bg-soft); }
.role-name { font-weight: 600; }
.role-code { font-size: 12px; color: var(--ds-text-3); margin-left: 6px; }
.role-meta { margin: 6px 0; display: flex; gap: 6px; }
.empty { color: var(--ds-text-3); padding: 24px; text-align: center; }
.form-row { display: flex; gap: 12px; }
.form-row > * { flex: 1; }
.perm-tree, .perm-matrix { max-height: 320px; overflow: auto; border: 1px solid var(--ds-border); border-radius: 8px; padding: 8px; margin-top: 8px; }
.perm-row { display: block; padding: 3px 0; }
.perm-code { font-size: 11px; color: var(--ds-text-3); margin-left: 6px; }
.matrix-row { display: flex; align-items: center; gap: 14px; padding: 4px 0; border-bottom: 1px dashed var(--ds-border); }
.matrix-table { width: 200px; font-weight: 600; }
.chk { margin-right: 4px; }
.footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }
.perm-empty { color: var(--ds-text-3); padding: 12px; text-align: center; font-size: 13px; }
</style>
