# minipost

> 一键部署 · 模块化 · RBAC · 像素级 UI 复刻（`minipost-ui.html`）

## 运行方式（推荐：服务器 Ubuntu 24 LTS）

**方式 A：一键脚本（自动安装 Docker + Compose）**
```bash
cd scripts && sudo bash bootstrap_online.sh
```

**方式 B：本地 Docker（已装好 Docker/Compose）**
```bash
# 首次（生成 .deploy.env）
cp compose/.deploy.env.example compose/.deploy.env

# 修改 compose/.deploy.env 中的 ADMIN_USER/ADMIN_PASS、数据库密码等

# 启动
docker compose -f compose/docker-compose.yml up -d --build

# 迁移/建表（如首次）
bash scripts/migrate.sh

# 查看日志（复制执行）
docker compose -f compose/docker-compose.yml logs web --tail=200
```

## 首次登录
- 访问：http://服务器IP:8000/admin
- 使用你在部署过程输入的 `ADMIN_USER` / `ADMIN_PASS` 登录（或 `.deploy.env` 中的账号）。

## 目录说明
- `app/`：FastAPI 主程序、配置、DB、启动与初始化。
- `modules/`：模块化目录（`navauth_shell` / `auth_login` / `core` / `label_upload` / `logistics_channel`）。
- `compose/`：Docker Compose 与环境变量模板。
- `docker/`：镜像 Dockerfile。
- `scripts/`：部署、迁移、备份/还原、菜单重载脚本。
- `migrations/`：数据库迁移骨架（当前首次安装用 `create_all` 自动建表）。
- `minipost_Field V1.1.yaml`：系统统一字段词表（SSoT）。

## 常用命令
- 查看 Web 容器日志（末尾 200 行）：
  ```bash
  docker compose -f compose/docker-compose.yml logs web --tail=200
  ```
- 查看 Postgres 日志（末尾 200 行）：
  ```bash
  docker compose -f compose/docker-compose.yml logs postgres --tail=200
  ```

## 端口
- 默认开放 `8000/tcp`（如启用 UFW，会自动 `ufw allow 8000/tcp`）

---
**本仓库已对齐你提供的目录结构与 UI 文件（像素级复刻来源：`minipost-ui.html`）。**
