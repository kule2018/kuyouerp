<template>
  <DsCard>
    <template #title>
      <div class="toolbar">
        <div class="titles">
          <span class="title">管理员与角色</span>
          <span class="sub">为账号分配角色，控制其可访问的数据范围</span>
        </div>
        <div class="grow" />
        <DsInput v-model="kw" size="sm" placeholder="搜索用户名 / 昵称" style="width: 220px" />
      </div>
    </template>
    <DsTable :columns="columns" :data="filteredRows" :loading="loading" striped>
      <template #role_id="{ row }">
        <DsSelect
          :model-value="row.roleId || 0"
          :options="roleOptions"
          @update:model-value="(v: number) => assign(row, v)"
        />
      </template>
      <template #status="{ row }">
        <DsTag :type="row.status === 'normal' ? 'success' : 'danger'">{{ row.status }}</DsTag>
      </template>
    </DsTable>
    <div v-if="!loading && !filteredRows.length" class="empty-hint">无匹配的管理员，换个关键词试试</div>
  </DsCard>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import request from '../../utils/request';
import { useToast } from '@/components/ds/toast';

const toast = useToast();
const rows = ref<any[]>([]);
const roles = ref<any[]>([]);
const loading = ref(false);

const roleOptions = ref<{ label: string; value: number }[]>([]);
const columns = [
  { key: 'id', title: 'ID', width: 70 },
  { key: 'username', title: '用户名' },
  { key: 'nickname', title: '昵称' },
  { key: 'role_id', title: '角色', slot: 'role_id' },
  { key: 'status', title: '状态', slot: 'status' },
];

/** 按用户名 / 昵称筛选 */
const kw = ref('');
const filteredRows = computed(() => {
  const k = kw.value.trim().toLowerCase();
  if (!k) return rows.value;
  return rows.value.filter(
    (r) => (r.username || '').toLowerCase().includes(k) || (r.nickname || '').toLowerCase().includes(k),
  );
});

async function load() {
  loading.value = true;
  try {
    const [admins, roleList] = await Promise.all([
      request({ url: 'rbac/admins', method: 'get' }),
      request({ url: 'rbac/roles', method: 'get' }),
    ]);
    rows.value = admins?.data || [];
    roles.value = roleList?.data || [];
    roleOptions.value = [
      { label: '超级管理员（无角色）', value: 0 },
      ...roles.value.map((r: any) => ({ label: r.name, value: r.id })),
    ];
  } finally {
    loading.value = false;
  }
}

async function assign(row: any, roleId: number) {
  await request({ url: `rbac/admins/${row.id}/role`, method: 'post', data: { roleId } });
  row.roleId = roleId;
  toast.success('角色已更新');
}

onMounted(load);
</script>

<style scoped>
.toolbar { display: flex; align-items: center; gap: 12px; }
.titles { display: flex; flex-direction: column; gap: 2px; }
.title { font-size: 15px; font-weight: 600; color: var(--ds-text); }
.sub { font-size: 12px; color: var(--ds-text-3); }
.grow { flex: 1; }
.empty-hint { padding: 24px; text-align: center; color: var(--ds-text-3); font-size: 13px; }
</style>
