# 09 · 部署上线

本章介绍生产环境构建与部署。整体是「前端静态资源 + 后端 Node 服务 + Nginx 反向代理」的经典组合。

---

## 1. 构建产物

### 后端
```bash
cd backend
npm install
npm run build          # 产出 dist/（nest build）
```
运行：
```bash
PORT=3000 npm run start:prod   # node dist/main.js
# 或使用进程管理器：pm2 start dist/main.js --name kuyou-backend
```

### 前端
```bash
cd frontend
npm install
npm run build          # vue-tsc 类型检查 + vite build，产出 dist/
```
`dist/` 为纯静态资源，可托管到任意静态服务器或 Nginx。

---

## 2. 配置要点

- **后端 `.env`**：生产环境务必修改 `JWT_SECRET`、`DB_PASSWORD` 为强随机值；`DB_SYNCHRONIZE=false`（表结构以 SQL 为准）；`PORT` 按实际暴露端口设置。
- **前端代理**：开发模式由 Vite 代理 `/kuyou`；**生产模式前端为静态资源**，不再有 Vite 代理，需由 Nginx（或网关）把 `/kuyou` 转发到后端。
- **上传目录**：后端用 `uploads/` 提供静态资源（`/uploads` 前缀），部署时确保该目录可写并随服务一起保留（建议挂载持久卷）。

---

## 3. Nginx 反向代理示例

```nginx
server {
    listen 80;
    server_name erp.example.com;

    # 前端静态资源
    location / {
        root  /var/www/kuyou-frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 上传文件
    location /uploads/ {
        alias /opt/kuyou-backend/uploads/;
    }

    # 后端接口
    location /kuyou/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> 说明：前端 `history` 模式路由需要 `try_files ... /index.html` 回退，否则刷新子路由会 404。

---

## 4. 进程与守护

推荐用 `pm2` 或系统 `systemd` 守护后端进程：

```bash
# pm2 示例
pm2 start dist/main.js --name kuyou-backend
pm2 save
pm2 startup
```

前端静态资源由 Nginx 直接服务，无需常驻 Node 进程。

---

## 5. 数据库迁移 / 升级

- 升级版本涉及表结构变化时，先备份 `kuyou` 库，再执行新版 `db/*.sql` 中新增的建表 / 改表语句；
- 重跑元数据生成脚本（见 [08 · 开发指南](./08-development.md) 第 3 节）以同步前后端；
- 因 `DB_SYNCHRONIZE=false`，TypeORM 不会自动改表，所有结构变更以 SQL 脚本为准，便于受控变更。

---

## 6. 安全建议

- 生产环境关闭 `start:dev`，使用编译后的 `dist`；
- `JWT_SECRET` 使用强随机值，并定期轮换；
- 数据库账号仅授予必要权限，禁止公网直连；
- 若启用 AI 模块，注意模型服务的数据出向合规；
- 上传目录限制可执行权限，避免上传恶意文件被执行。
