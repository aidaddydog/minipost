
# Minipost + Huandan UI 一键整合包

作用：把“项目文件 UI（huandan UI V1.0）”模块化为 Vue3 + Vite 组件/页面，并与后端( FastAPI )与换单客户端兼容接口打通；提供一键部署脚本与 docker-compose。

## 覆盖说明（git 操作）

```bash
# 在你的 minipost 仓库根目录执行
unzip -o minipost_vue_integration_pack.zip -d .
git add .
git commit -m "feat(ui): integrate huandan UI into Vue components and add huandan client endpoints"
git push
```

随后在服务器执行一键部署：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/aidaddydog/minipost/main/scripts/bootstrap_online.sh)
```

## 目录要点

- frontend/：Vue3 + Vite + Pinia + vue-router
  - src/components/LayoutShell.vue：UI 壳层（Logo/一级胶囊导航/二级/三级页签）
  - src/modules/orders/views/LabelUploadList.vue：面单列表
  - src/modules/orders/views/LabelUploadLogs.vue：上传记录
  - src/styles/huandan-ui.css：视觉变量与样式
  - utils/http.ts：axios 实例（`baseURL=/api/v1`，含 `X-Tenant-ID`）

- backend/：FastAPI
  - app/domain/orders/*：列表/记录/预览/提交换单
  - app/domain/huandan/*：换单客户端兼容接口（`/api/v1/huandan/*`）
  - app/core/middleware/tenant.py：多租户头 `X-Tenant-ID`

- deploy/docker-compose.yml：Web(Caddy) + Backend(Uvicorn) + Postgres
- scripts/bootstrap_online.sh：一键部署脚本

