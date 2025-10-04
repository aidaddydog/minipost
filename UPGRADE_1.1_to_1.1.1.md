# 升级说明：1.1 → 1.1.1

本升级包属于**就地覆盖型**补丁，仅变更少量文件，不破坏现有数据库与模块结构。

## 变更列表
- `app/settings.py`：新增 `CORS_ORIGINS`，生产默认关闭 CORS。
- `app/main.py`：CORS 参数化，开发模式默认放行 `http://localhost:5173`。
- `app/api/v1/nav.py`：`/nav/reload` 需 `rbac:manage` 权限。
- `app/db.py`：数据库异常发生时自动 `rollback()`。
- `deploy/docker-compose.override.yml`：将 web 健康检查改为请求 `/readyz`。
- `deploy/nginx.conf`：添加常用安全响应头（HSTS/CSP 等）。
- `README.md`：新增项目总览与运行指南。
- `tests/test_health.py`：最小化健康检查单测。

## 覆盖步骤
1. 在你的 GIT 仓库根目录解压覆盖本压缩包（保持路径结构）。
2. 检查/补充 `.deploy.env`：
   - 强制设置 `JWT_SECRET` 为高强度随机值（不少于 32 字节）。
   - 如需跨域，设置 `CORS_ORIGINS="https://your-admin.example.com"`（逗号分隔）。
3. （可选）使用 `docker-compose.override.yml` 启动时自动生效：
   ```bash
   docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.override.yml up -d --build
   ```
4. 初始化与自检：
   ```bash
   docker compose exec -T web alembic upgrade head
   docker compose exec -T web python -m app.bootstrap init-admin --username admin --password 强密码
   curl -s http://127.0.0.1:8000/readyz | jq .
   ```

## 回滚说明
- 仅涉及上述文件，使用 Git 可直接 `git checkout -- <文件>` 回滚。
