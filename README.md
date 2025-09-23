# minipost.app

> 前后端分离 · FastAPI + PostgreSQL · Vue3 + Vite · 多租户 

## 一键上线（推荐）
在服务器（Ubuntu 22+/24+）执行：
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/aidaddydog/minipost/main/scripts/bootstrap_online.sh)
```
脚本会自动安装 Docker/Compose（如缺失）、构建镜像、放行端口、做健康检查，并在结尾打印公网入口：
- 前端：`http://<你的IP>/`
- Swagger：`http://<你的IP>/docs`
- 健康检查：`http://<你的IP>/api/health`

## 目录
- `frontend/`：Vue3 + Vite（Caddy 静态与反代）
- `backend/`：FastAPI + SQLAlchemy + asyncpg
- `docs/`：字段词表（运单号/转单号口径约定）
- `deploy/docker-compose.yml`：生产编排
- `scripts/bootstrap_online.sh`：一键上线（彩色进度/日志）

## 多租户
- 通过请求头 `X-Tenant-ID` 注入，默认 `demo-tenant`。

## 号码三件套（口径统一）
- 订单号：`order_no`
- 运单号（服务商）：`tracking_no`
- 转单号（服务商）：`transfer_waybill_no`（= `transfer_tracking_no` 别名）

## 本地（可选）
```bash
# 构建并启动（需 Docker）
docker compose -f deploy/docker-compose.yml up -d --build
# 查看日志
docker compose -f deploy/docker-compose.yml logs backend -n 200
```
