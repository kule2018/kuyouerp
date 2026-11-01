<template>
  <router-view />
  <!-- 全局轻提示容器：useToast() 的消息统一在此渲染 -->
  <DsToast />
  <!-- 全局确认弹窗：confirm() 的对话框在此渲染 -->
  <DsConfirm />
  <!-- 全局 AI 智能助手（对话 / 经营分析 / 单据识别） -->
  <AiAssistant />
</template>

<script setup lang="ts">
// 根组件：承载路由视图 + 全局 Toast 容器 + 全局确认弹窗
import DsToast from './components/ds/DsToast.vue';
import DsConfirm from './components/ds/DsConfirm.vue';
import AiAssistant from './components/AiAssistant.vue';
</script>
