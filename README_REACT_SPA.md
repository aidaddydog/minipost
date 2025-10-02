# React SPA 接入说明（Node 默认在容器内）

- 本次交付将所有模块模板 **React 化**，采用：React + Radix + Tailwind + 单一 LayerManager（shadcn 风格）。
- Docker 多阶段镜像在 **构建时自动安装 Node 并构建前端**；宿主机 **不需要** 安装 Node。

## 常用命令（开发环境）
```bash
# 本地开发（需要本机 Node 18+）：
cd frontend && npm install && npm run dev
# 打包并写入 ../static/assets
npm run build
```

## 生产部署（在线一键）
仍使用：
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/aidaddydog/minipost/main/scripts/bootstrap_online.sh)
```
该脚本会执行 Docker 构建，前端会在镜像内完成编译并注入 /app/static/assets。

## SPA 行为
- FastAPI 会优先返回 `/static/assets/index.html`（若存在）作为入口；
- `/api/*`、`/static/*`、`/modules/*` 等由原有路由处理；
- 其它路径回退到 SPA（React Router 处理）。
