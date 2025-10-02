# DEPLOY

## 在线一键部署
```bash
sudo -i
cd /opt
unzip minipost.zip -d /opt
cd /opt/minipost
./scripts/bootstrap_online.sh
```

流程：Preflight 自检 → 自动安装 Docker/Compose → 启动 Postgres16 → Alembic 迁移 → 初始化管理员 → 启动 Web → UFW 端口策略 → 输出访问 URL 与三条日志命令：
- systemd：`journalctl -u minipost.service -e -n 200`
- Docker ：`docker compose -f deploy/docker-compose.yml logs web --tail=200`
- Nginx ：`tail -n 200 /var/log/nginx/error.log`

## 离线一键部署
将 `offline/` 目录准备好 Docker/Compose 的 `.deb` 包与镜像 `*.tar`，再执行：
```bash
sudo -i
cd /opt/minipost
./scripts/bootstrap_offline.sh
```

## 备份与回滚
```bash
# 备份
./scripts/backup_restore.sh backup
# 回滚
./scripts/backup_restore.sh restore backups/pg_xxx.sql.gz
```
