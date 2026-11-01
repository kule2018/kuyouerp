<template>
  <div class="login-wrap">
    <DsCard class="login-card">
      <div class="title">ERP系统</div>
      <form @submit.prevent="onLogin">
        <DsField label="用户名">
          <DsInput v-model="form.username" placeholder="请输入用户名" />
        </DsField>
        <DsField label="密码">
          <DsInput v-model="form.password" type="password" placeholder="请输入密码" />
        </DsField>
        <DsButton variant="primary" :loading="loading" style="width: 100%" @click="onLogin">
          登 录
        </DsButton>
      </form>
      <div class="tip">演示账号：admin / 123456</div>
    </DsCard>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import request from '../utils/request';
import { setAuth } from '../store/auth';
import { useRouter } from 'vue-router';
import { useToast } from '@/components/ds/toast';

const router = useRouter();
const toast = useToast();
const form = reactive({ username: '', password: '' });
const loading = ref(false);

/** 登录并写入凭证后跳转首页 */
async function onLogin() {
  loading.value = true;
  try {
    const res: any = await request({ url: 'index/login', method: 'post', data: form });
    setAuth(res.data);
    toast.success('登录成功');
    router.push('/');
  } catch (e) {
    /* 错误已由拦截器提示 */
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-wrap {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1f2d3d, #3a506b);
}
.login-card {
  width: 360px;
  padding: 10px 20px;
}
.title {
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  margin-top: 8px;
}
.subtitle {
  text-align: center;
  color: var(--ds-text-3);
  margin: 6px 0 18px;
}
.tip {
  text-align: center;
  color: #c0c4cc;
  font-size: 12px;
  margin-top: 12px;
}
</style>
