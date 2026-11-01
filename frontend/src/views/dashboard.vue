<template>
  <div>
    <h2>仪表盘</h2>
    <div class="stat-grid">
      <DsCard v-for="c in cards" :key="c.label" hoverable>
        <div class="stat-label">{{ c.label }}</div>
        <div class="stat-value">{{ c.value }}</div>
      </DsCard>
    </div>
    <DsAlert
      style="margin-top: 20px"
      title="说明"
      type="info"
      description="erp系统"
    />

    <h2 style="margin-top: 24px">AI 经营分析</h2>
    <div class="ai-actions">
      <DsButton
        v-for="a in aiActions"
        :key="a.q"
        variant="primary"
        size="sm"
        @click="goAi(a.q)"
      >{{ a.label }}</DsButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { list } from '../api/dynamic';

const router = useRouter();

/** 业务模块一键直达 AI 经营分析（自动带入分析意图，后端工具实时取数） */
const aiActions = [
  { label: '库存预警', q: '请分析当前库存低于安全库存/缺货的商品有哪些，并给出紧急程度。' },
  { label: '智能补货建议', q: '请根据近30天销售为我生成智能补货建议清单（含建议采购量）。' },
  { label: '销售排行', q: '请统计近30天销售额排行前20的热销商品。' },
  { label: '应收分析', q: '请列出当前存在应收欠款的客户及金额，并按金额排序。' },
  { label: '呆滞库存', q: '请找出近30天无销售却仍有库存的呆滞/积压商品。' },
];
function goAi(q: string) {
  router.push({ name: 'ai', query: { q } });
}

const stats = reactive({ goods: 0, customers: 0, suppliers: 0, stores: 0 });

/** 统计卡片配置（标签 + 取值字段） */
const cards = computed(() => [
  { label: '商品总数', value: stats.goods },
  { label: '客户数', value: stats.customers },
  { label: '供应商数', value: stats.suppliers },
  { label: '仓库数', value: stats.stores },
]);

/**
 * 取各表 total（limit=1 仅需计数）。
 * @param table 表名
 * @returns 记录总数
 */
async function totalOf(table: string): Promise<number> {
  const res: any = await list(table, { limit: 1 });
  return res.total || 0;
}

/** 加载四项统计 */
async function load() {
  stats.goods = await totalOf('kuyou_goods');
  stats.customers = await totalOf('kuyou_customers');
  stats.suppliers = await totalOf('kuyou_suppliers');
  stats.stores = await totalOf('kuyou_stores');
}

onMounted(load);
</script>

<style scoped>
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.stat-label {
  color: var(--ds-text-3);
  font-size: 13px;
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
  margin-top: 6px;
  color: var(--ds-text);
}
.ai-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}
</style>
