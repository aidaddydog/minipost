# MiniPost 系统基座

> 本目录为 **修复版 1.1 升级补丁** 已应用的代码（2025-10-04）。

## 关键改动
- 参数化 CORS：新增 `CORS_ORIGINS` 环境变量，生产默认关闭 CORS；开发环境自动放行 `http://localhost:5173`。
- `/nav/reload` 权限收紧：仅 `rbac:manage` 拥有者可刷新导航缓存。
- 数据库会话更健壮：`get_db()` 在异常时 `rollback()`，避免悬挂事务。
- Docker 健康检查：web 服务检查 `/readyz`，确保数据库与导航就绪。
- Nginx 安全头：添加 HSTS/CSP 等，提升默认安全性。

## 环境变量（.deploy.env）
```env
APP_HOST=0.0.0.0
APP_PORT=8000
ENVIRONMENT=production
# 逗号分隔白名单；生产不需要开放跨域可留空
CORS_ORIGINS=
# 强随机密钥（必须自定义）
JWT_SECRET=请替换为高强度随机串
JWT_EXPIRES_MINUTES=480
# Postgres
PG_HOST=postgres
PG_PORT=5432
PG_DB=minipost
PG_USER=minipost
PG_PASSWORD=请替换为强密码
```

## 本地开发
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export PG_HOST=127.0.0.1 PG_PORT=5432 PG_DB=minipost PG_USER=postgres PG_PASSWORD=你的密码
export JWT_SECRET=$(openssl rand -hex 32)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# 另启终端
npm install
npm run dev  # http://localhost:5173
```

## 容器部署（片段）
```bash
DOCKER_BUILDKIT=1 docker build -t minipost-web -f deploy/Dockerfile .
docker compose -f deploy/docker-compose.yml up -d
docker compose -f deploy/docker-compose.yml exec -T web alembic upgrade head
docker compose -f deploy/docker-compose.yml exec -T web   python -m app.bootstrap init-admin --username admin --password 强密码
```

## 许可
见 `LICENSE`。
