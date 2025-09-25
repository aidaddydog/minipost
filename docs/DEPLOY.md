# 部署说明（简要）
- `compose/docker-compose.yml`：web + postgres
- `compose/docker-compose.nginx.yml`：叠加 Nginx
- `scripts/migrate.sh`：迁移并重建导航
- `scripts/reload_nav.sh`：热更新导航缓存
