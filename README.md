# minipost（最优解·最终版）

> Docker Compose 生产取向 · FastAPI + SQLAlchemy 2.0 · PostgreSQL 16 · 非 SPA 模块化前端（像素级复刻 UI 原稿）

- 一键部署（必须 root）：
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/aidaddydog/minipost/main/scripts/bootstrap_online.sh)
```
- 本地（手动）部署：
```bash
cp compose/.deploy.env.example compose/.deploy.env
docker compose -f compose/docker-compose.yml up -d --build
docker compose -f compose/docker-compose.yml exec -T web bash -lc "python -m app.bootstrap migrate && python -m app.bootstrap init-admin --user admin --password 'Your@Pass123' && python -m app.bootstrap reload-nav"
```

- 统一日志目录（容器内/宿主机挂载）：`/var/log/minipost/`
- 访问：`http://<服务器IP>:8000/`

> 重要：所有实体/DTO/接口字段与枚举均来自 **SSoT（app/ssot/minipost_Field V1.1.yaml）**；传参与返回用英文，前端映射中文。
