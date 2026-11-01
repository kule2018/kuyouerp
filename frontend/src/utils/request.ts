import axios from 'axios';
import { useToast } from '@/components/ds/toast';
import router from '../router';

/**
 * Axios 实例
 * - baseURL 指向后端全局前缀 /kuyou（开发期由 Vite 代理转发到 3000 端口）
 * - 请求拦截：自动携带 JWT
 * - 响应拦截：统一处理 code=0 / 401
 */
const request = axios.create({
  baseURL: '/kuyou',
  timeout: 30000,
});

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    const headers = (config.headers || {}) as Record<string, any>;
    headers.Authorization = `Bearer ${token}`;
    config.headers = headers as any;
  }
  return config;
});

request.interceptors.response.use(
  (response) => {
    const data = response.data;
    // 业务失败：{ code: 0, msg }
    if (data && data.code === 0) {
      // 后端统一把 401（登录态失效）包装成 code:0 且 msg='请先登陆'，
      // 必须在这里真正清理凭证并跳登录页，否则会一直弹「请先登陆」却停留在原页。
      if (data.msg === '请先登陆') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        useToast().error('登录已失效，请重新登录');
        router.replace('/login');
      } else {
        useToast().error(data.msg || '操作失败');
      }
      return Promise.reject(new Error(data.msg));
    }
    return data;
  },
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      useToast().error('登录已失效，请重新登录');
      router.replace('/login');
    } else {
      useToast().error(error.response?.data?.msg || '网络异常');
    }
    return Promise.reject(error);
  },
);

export default request;
