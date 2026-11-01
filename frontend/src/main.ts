import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { installDsUi } from './components';
import { permissionDirective } from './directives/permission';
import { initPermissionStore, refreshAuth } from './store/auth';

const app = createApp(App);
app.use(router);
// DeepSeek UI 设计系统：注册全部 Ds* / Base* 组件并加载 theme.css（含明/暗双主题）
installDsUi(app);
// 还原持久化权限（避免刷新后菜单/按钮被隐藏）
initPermissionStore();
// 用当前 token 向服务端拉取最新权限，覆盖可能陈旧的本地缓存（防止菜单点不动/被守卫拦回首页）
refreshAuth();
// 权限指令：v-permission
app.directive('permission', permissionDirective);
app.mount('#app');
