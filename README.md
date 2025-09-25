# minipost

> 一键部署的 ERP/OMS/TMS 后台（FastAPI + PostgreSQL + Docker Compose）。  
> **像素级复刻**您提供的 UI，并按统一字段规范实现后端接口。

## 一键部署（Ubuntu 24.x / 1Panel 兼容）

```bash
# 克隆或上传本仓库后，在服务器执行：
bash scripts/bootstrap_online.sh
```

- 首次启动会自动：
  - 生成 `.deploy.env`
  - 构建镜像、启动容器
  - 运行 Alembic 迁移、初始化角色/管理员
  - 自动放行端口（UFW 存在且启用时）
- 管理后台地址：`http://<服务器IP>:8080/admin`
- API 登录：`POST /api/auth/login`（默认账号 `admin` / `Admin@123456`）

> 日志调取（复制执行）：`docker compose -f compose/docker-compose.yml logs app --tail=200`

## 目录结构（与您提供一致）

详见仓库根目录下 `minipost/`。模块划分、配置与前端模板路径与您文件一致。

## 技术栈

- FastAPI + SQLAlchemy + Alembic
- PostgreSQL 16（容器）
- 前端模板：按模块分发，`modules/*/frontend/*`  
- 一键脚本：`scripts/*.sh`（中文进度提示 + 二次覆盖清理 + 自动放行端口）

## 字段规范

已内置并遵循统一字段词表（见 `app/` 中引用），数据表使用 snake_case 命名，时间统一 UTC。  
（如需扩展，建议以 Alembic 迁移演进。）

## 常用命令

- 迁移：`bash scripts/migrate.sh`
- 导航重载：`bash scripts/reload_nav.sh`
- 数据库备份：`bash scripts/backup_pg.sh`
- 数据库恢复：`bash scripts/restore_pg.sh`

---
