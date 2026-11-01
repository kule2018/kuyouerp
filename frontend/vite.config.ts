import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

/** 后端地址（dev / preview 都由 Vite 代理转发，前端只认 /kuyou 前缀；可用 BACKEND_ORIGIN 覆盖） */
const BACKEND = process.env.BACKEND_ORIGIN || 'http://localhost:3000';

/**
 * Vite 配置
 * - dev 5173 / preview 4173
 * - 将 /kuyou 代理到后端，开发期免跨域、API 基址直接写 /kuyou
 * - 别名 @ -> src（便于跨目录引用组件 / 工具）
 * - 产物按体积拆分：路由配置与 xlsx 各自独立成 chunk，避免单包超 500 kB 告警
 */
export default defineConfig({
  // 依赖预构建缓存目录。指向全新路径，避免启动时清理旧缓存（旧环境注入的 safe-delete 会卡死）。
  cacheDir: 'node_modules/.vite-dev',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/kuyou': {
        target: BACKEND,
        changeOrigin: true,
      },
    },
  },
  // preview 不继承 server.proxy，必须显式再配一次，否则打包产物无法联调后端
  preview: {
    port: 4173,
    proxy: {
      '/kuyou': {
        target: BACKEND,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // app-config 是 156 张表的字段元数据（纯数据，压缩后约 35 kB），体积天然偏大，
    // 属预期产物而非代码冗余，故放宽阈值，避免每次构建都刷无意义告警。
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        /**
         * 手动分块：把体积大且低频变动的依赖拆出去。
         * @param id 模块绝对路径
         * @returns chunk 名；返回 undefined 走默认分块策略
         */
        manualChunks(id: string) {
          if (id.includes('node_modules/xlsx')) return 'vendor-xlsx';
          if (id.includes('/src/config/')) return 'app-config';
          return undefined;
        },
      },
    },
  },
});
