<template>
  <div class="ai-page">
    <DsTabs
      v-model="tab"
      :items="[
        { label: '对话', value: 'chat' },
        { label: 'Agent 自主执行', value: 'agent' },
        { label: '关键词检索', value: 'retrieve' },
        { label: '模型配置', value: 'model' },
        { label: 'Prompt 模板', value: 'tpl' },
        { label: '知识库', value: 'kb' },
        { label: '调用日志', value: 'log' },
      ]"
    />

    <!-- 一次性对话 -->
    <div v-show="tab === 'chat'" class="pane">
      <div class="chat-grid">
        <div class="chat-main">
          <DsInput
            v-model="chat.system"
            type="textarea"
            :rows="2"
            placeholder="系统提示（可留空，或用 Prompt 模板）"
          />
          <DsInput
            v-model="chat.input"
            type="textarea"
            :rows="6"
            placeholder="请输入问题，例如：统计本月商品库存低于安全库存的有哪些？"
            style="margin-top: 8px"
          />
          <div class="btn-row">
            <DsButton variant="primary" :loading="chat.loading" @click="sendChat">发送</DsButton>
            <DsCheckbox v-model="chat.useTools">启用工具调用</DsCheckbox>
            <DsCheckbox v-model="chat.jsonMode">结构化 JSON 输出</DsCheckbox>
          </div>
          <DsCard v-if="chat.result" class="result">
            <pre>{{ chat.result }}</pre>
          </DsCard>
        </div>
        <div class="chat-side">
          <div class="side-title">模型</div>
          <DsSelect
            v-model="chat.modelConfigId"
            placeholder="默认模型"
            clearable
            :options="models.map((m: any) => ({ label: m.name, value: m.id }))"
          />
          <div class="side-title">Prompt 模板</div>
          <DsSelect
            v-model="chat.templateCode"
            placeholder="不使用模板"
            clearable
            :options="templates.map((t: any) => ({ label: t.name, value: t.code }))"
          />
          <div class="side-title">已注册工具</div>
          <div class="tools">
            <DsTag v-for="t in tools" :key="t.name" size="sm" color="neutral">{{ t.name }}</DsTag>
          </div>
        </div>
      </div>
    </div>

    <!-- Agent 多轮自主执行 -->
    <div v-show="tab === 'agent'" class="pane">
      <DsInput
        v-model="agent.goal"
        type="textarea"
        :rows="3"
        placeholder="请输入目标，例如：查库存低于 10 的商品并生成采购建议"
      />
      <div class="btn-row">
        <DsButton variant="primary" :loading="agent.loading" @click="runAgent">执行</DsButton>
        <DsInput type="number" v-model="agent.maxTurns" :min="1" :max="20" size="sm" style="width: 90px" />
        <span class="hint">最大轮次</span>
        <DsCheckbox v-model="agent.useTools">启用工具调用</DsCheckbox>
      </div>
      <DsCard v-if="agent.result" class="result">
        <pre>{{ agent.result }}</pre>
      </DsCard>
    </div>

    <!-- 关键词检索 -->
    <div v-show="tab === 'retrieve'" class="pane">
      <div class="retrieve-row">
        <DsInput v-model="kw" class="grow" placeholder="输入检索关键词" @keyup.enter="doRetrieve" />
        <DsInput type="number" v-model="topK" :min="1" :max="50" size="sm" style="width: 90px" />
        <DsButton variant="primary" @click="doRetrieve">检索</DsButton>
      </div>
      <DsTable
        :data="hits"
        :columns="[
          { title: 'ID', key: 'id', width: '70px' },
          { title: '标题', key: 'title', width: '200px' },
          { title: '内容', key: 'content' },
          { title: '相关度', key: 'score', width: '90px' },
        ]"
        style="margin-top: 10px"
      />
    </div>

    <!-- 模型配置 -->
    <div v-show="tab === 'model'" class="pane">
      <div class="btn-row">
        <DsButton variant="primary" size="sm" @click="newModel">新增模型</DsButton>
      </div>
      <DsTable
        :data="models"
        :columns="[
          { title: 'ID', key: 'id', width: '70px' },
          { title: '名称', key: 'name' },
          { title: '厂商', key: 'provider' },
          { title: '模型', key: 'model' },
          { title: '接口地址', key: 'baseUrl' },
          { title: '启用', key: 'enabled', width: '70px' },
          { title: '操作', key: 'act', slot: true, width: '120px' },
        ]"
      >
        <template #act="{ row }">
          <DsButton variant="text" @click="editModel(row)">编辑</DsButton>
          <DsButton variant="text" class="danger-link" @click="requestDel('/ai/model-config/' + row.id, loadModels)">删除</DsButton>
        </template>
      </DsTable>
    </div>

    <!-- Prompt 模板 -->
    <div v-show="tab === 'tpl'" class="pane">
      <div class="btn-row">
        <DsButton variant="primary" size="sm" @click="newTpl">新增模板</DsButton>
      </div>
      <DsTable
        :data="templates"
        :columns="[
          { title: 'ID', key: 'id', width: '70px' },
          { title: '编码', key: 'code', width: '160px' },
          { title: '名称', key: 'name', width: '180px' },
          { title: '内容', key: 'content' },
          { title: '操作', key: 'act', slot: true, width: '120px' },
        ]"
      >
        <template #act="{ row }">
          <DsButton variant="text" @click="editTpl(row)">编辑</DsButton>
          <DsButton variant="text" class="danger-link" @click="requestDel('/ai/prompt-template/' + row.id, loadTpls)">删除</DsButton>
        </template>
      </DsTable>
    </div>

    <!-- 知识库 -->
    <div v-show="tab === 'kb'" class="pane">
      <div class="btn-row">
        <DsButton variant="primary" size="sm" @click="newKb">新增条目</DsButton>
      </div>
      <DsTable
        :data="kb"
        :columns="[
          { title: 'ID', key: 'id', width: '70px' },
          { title: '标题', key: 'title', width: '220px' },
          { title: '内容', key: 'content' },
          { title: '操作', key: 'act', slot: true, width: '120px' },
        ]"
      >
        <template #act="{ row }">
          <DsButton variant="text" @click="editKb(row)">编辑</DsButton>
          <DsButton variant="text" class="danger-link" @click="requestDel('/ai/knowledge/' + row.id, loadKb)">删除</DsButton>
        </template>
      </DsTable>
    </div>

    <!-- 调用日志 -->
    <div v-show="tab === 'log'" class="pane">
      <DsTable
        :data="logs"
        :clickable="true"
        @row-click="onLogRow"
        :columns="[
          { title: 'ID', key: 'id', width: '70px' },
          { title: '模型', key: 'model', width: '140px' },
          { title: 'Tokens', key: 'tokens', width: '90px' },
          { title: '耗时(ms)', key: 'latency', width: '100px' },
          { title: '时间', key: 'createtime', width: '180px' },
          { title: '状态', key: 'status', width: '90px' },
        ]"
      />
      <div class="side-title" v-if="toolLogs.length">工具调用记录</div>
      <DsTable
        v-if="toolLogs.length"
        :data="toolLogs"
        style="margin-top: 6px"
        :columns="[
          { title: 'ID', key: 'id', width: '70px' },
          { title: '工具', key: 'tool_name', width: '160px' },
          { title: '入参', key: 'arguments' },
          { title: '结果', key: 'result' },
        ]"
      />
    </div>

    <!-- 通用编辑对话框 -->
    <DsModal v-model="dlg.show" :title="dlg.title" :width="600">
      <div class="dlg-form">
        <DsField v-for="f in dlg.fields" :key="f.prop" :label="f.label">
          <DsInput v-if="f.type === 'textarea'" v-model="dlg.form[f.prop]" type="textarea" :rows="6" />
          <DsInput v-else-if="f.type === 'number'" v-model="dlg.form[f.prop]" type="number" />
          <DsInput v-else v-model="dlg.form[f.prop]" :placeholder="f.label" />
        </DsField>
      </div>
      <template #footer>
        <DsButton @click="dlg.show = false">取消</DsButton>
        <DsButton variant="primary" @click="saveDlg">保存</DsButton>
      </template>
    </DsModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@/components/ds/toast';
import request from '../utils/request';
import { confirm } from '@/components/ds/useConfirm';

/**
 * AI 控制台
 * 对应后端 NestJS 的 AI 模块（@tool 装饰器 + ToolCallbacks + ChatClient + Agent + 关键词检索 + 日志）
 * 路由基址 /kuyou/ai/*，由 request 统一携带 JWT。
 */

const toast = useToast();
const tab = ref('chat');

/* ---------------- 对话 ---------------- */
const chat = reactive({
  system: '',
  input: '',
  useTools: true,
  jsonMode: false,
  modelConfigId: undefined as number | undefined,
  templateCode: '',
  result: '',
  loading: false,
});

async function sendChat() {
  if (!chat.input) return;
  chat.loading = true;
  try {
    const payload: any = {
      messages: [{ role: 'user', content: chat.input }],
      useTools: chat.useTools,
      modelConfigId: chat.modelConfigId,
    };
    if (chat.system) payload.system = chat.system;
    if (chat.templateCode) payload.templateCode = chat.templateCode;
    if (chat.jsonMode) payload.responseFormat = 'json_object';
    const res: any = await request.post('/ai/chat', payload);
    const d = res?.data ?? res;
    chat.result = typeof d === 'string' ? d : JSON.stringify(d, null, 2);
  } catch (e: any) {
    toast.error(e?.message || '调用失败');
  } finally {
    chat.loading = false;
  }
}

/* ---------------- Agent ---------------- */
const agent = reactive({ goal: '', maxTurns: 8, useTools: true, result: '', loading: false });
async function runAgent() {
  if (!agent.goal) return;
  agent.loading = true;
  try {
    const res: any = await request.post('/ai/agent', {
      goal: agent.goal,
      maxTurns: agent.maxTurns,
      useTools: agent.useTools,
    });
    const d = res?.data ?? res;
    agent.result = typeof d === 'string' ? d : JSON.stringify(d, null, 2);
  } catch (e: any) {
    toast.error(e?.message || '执行失败');
  } finally {
    agent.loading = false;
  }
}

/* ---------------- 关键词检索 ---------------- */
const kw = ref('');
const topK = ref(5);
const hits = ref<any[]>([]);
async function doRetrieve() {
  const res: any = await request.post('/ai/retrieve', { query: kw.value, topK: topK.value });
  hits.value = (res?.data as any[]) || [];
}

/* ---------------- 模型 / 模板 / 知识库 / 日志 ---------------- */
const models = ref<any[]>([]);
const templates = ref<any[]>([]);
const kb = ref<any[]>([]);
const tools = ref<any[]>([]);
const logs = ref<any[]>([]);
const toolLogs = ref<any[]>([]);

async function loadModels() {
  const r: any = await request.get('/ai/model-config');
  models.value = (r?.data as any[]) || [];
}
async function loadTpls() {
  const r: any = await request.get('/ai/prompt-template');
  templates.value = (r?.data as any[]) || [];
}
async function loadKb() {
  const r: any = await request.get('/ai/knowledge');
  kb.value = (r?.data as any[]) || [];
}
async function loadTools() {
  const r: any = await request.get('/ai/tools');
  const defs = (r?.data as any[]) || [];
  tools.value = defs.map((d: any) => ({ name: d?.function?.name || d?.name || 'unknown' }));
}
async function loadLogs() {
  const r: any = await request.get('/ai/call-logs', { params: { limit: 50 } });
  logs.value = (r?.data as any[]) || [];
}

async function onLogRow(row: any) {
  const r: any = await request.get('/ai/tool-logs', { params: { callLogId: row.id } });
  toolLogs.value = (r?.data as any[]) || [];
}

/** 通用删除：确认后调用 DELETE 并刷新 */
async function requestDel(url: string, cb: () => void) {
  if (!(await confirm('确认删除该记录？', '提示'))) return;
  await request.delete(url);
  toast.success('删除成功');
  cb();
}

/* ---------------- 通用编辑对话框 ---------------- */
const dlg = reactive<{
  show: boolean;
  title: string;
  url: string;
  method: 'post' | 'put';
  fields: { prop: string; label: string; type?: string }[];
  form: Record<string, any>;
}>({ show: false, title: '', url: '', method: 'post', fields: [], form: {} });

const MODEL_FIELDS = [
  { prop: 'name', label: '名称' },
  { prop: 'provider', label: '厂商' },
  { prop: 'model', label: '模型标识' },
  { prop: 'baseUrl', label: '接口地址' },
  { prop: 'apiKey', label: 'API Key' },
  { prop: 'temperature', label: '温度', type: 'number' },
  { prop: 'enabled', label: '启用', type: 'number' },
];
const TPL_FIELDS = [
  { prop: 'code', label: '编码' },
  { prop: 'name', label: '名称' },
  { prop: 'content', label: '模板内容', type: 'textarea' },
];
const KB_FIELDS = [
  { prop: 'title', label: '标题' },
  { prop: 'content', label: '内容', type: 'textarea' },
];

function openDlg(title: string, url: string, method: 'post' | 'put', fields: any[], row?: any) {
  dlg.title = title;
  dlg.url = url;
  dlg.method = method;
  dlg.fields = fields;
  dlg.form = row ? { ...row } : Object.fromEntries(fields.map((f: any) => [f.prop, '']));
  dlg.show = true;
}
const newModel = () => openDlg('新增模型', '/ai/model-config', 'post', MODEL_FIELDS);
const editModel = (row: any) => openDlg('编辑模型', `/ai/model-config/${row.id}`, 'put', MODEL_FIELDS, row);
const newTpl = () => openDlg('新增模板', '/ai/prompt-template', 'post', TPL_FIELDS);
const editTpl = (row: any) => openDlg('编辑模板', `/ai/prompt-template/${row.id}`, 'put', TPL_FIELDS, row);
const newKb = () => openDlg('新增知识条目', '/ai/knowledge', 'post', KB_FIELDS);
const editKb = (row: any) => openDlg('编辑知识条目', `/ai/knowledge/${row.id}`, 'put', KB_FIELDS, row);

async function saveDlg() {
  try {
    if (dlg.method === 'post') await request.post(dlg.url, dlg.form);
    else await request.put(dlg.url, dlg.form);
    toast.success('保存成功');
    dlg.show = false;
    loadModels();
    loadTpls();
    loadKb();
  } catch (e: any) {
    toast.error(e?.message || '保存失败');
  }
}

onMounted(() => {
  // 支持从业务模块（如仪表盘）带 ?q= 预填问题并自动发起分析
  const q = useRoute().query?.q;
  if (q && typeof q === 'string') {
    chat.system = '你是企业 ERP 经营分析助手，基于真实业务数据，用简体中文给出可执行的结论与建议。';
    chat.input = q;
    chat.useTools = true;
    sendChat();
  }
  loadModels();
  loadTpls();
  loadKb();
  loadTools();
  loadLogs();
});
</script>

<style scoped>
.ai-page { padding: 12px; }
.pane { margin-top: 12px; }
.chat-grid { display: flex; gap: 12px; align-items: flex-start; }
.chat-main { flex: 2; min-width: 0; }
.chat-side { flex: 1; min-width: 0; }
.retrieve-row { display: flex; gap: 8px; align-items: center; }
.grow { flex: 1; }
.dlg-form { display: flex; flex-direction: column; gap: 14px; }
.btn-row { display: flex; align-items: center; gap: 10px; margin: 8px 0; flex-wrap: wrap; }
.hint { color: #909399; font-size: 12px; }
.side-title { margin: 10px 0 6px; font-weight: 600; font-size: 13px; }
.tools { display: flex; flex-wrap: wrap; gap: 6px; }
.result { margin-top: 10px; max-height: 420px; overflow: auto; }
.result pre { white-space: pre-wrap; word-break: break-all; font-size: 12px; }
/* 危险文字按钮（原 el-button link type="danger"） */
.ds-btn.danger-link { color: var(--ds-danger); }
.ds-btn.danger-link:hover:not(:disabled) { color: var(--ds-danger); background: var(--ds-danger-soft, rgba(220, 38, 38, 0.1)); }
</style>
