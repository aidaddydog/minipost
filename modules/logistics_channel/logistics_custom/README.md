# logistics_custom 模块

> 自定义物流（L3）——可插拔模块；仅通过 YAML 注册到“物流 → 物流渠道 → 自定义物流”。
> 生成时间：2025-09-26 18:27:31 UTC

## 功能
- 复用 Label_upload 的视觉基元（.toolbar/.btn/.input/.select/.table-wrap/.modal/.cselect/.footer-bar），仅替换数据与交互。
- 后端提供最小可用 REST：查询、新增/编辑、启用/停用、软删、下拉源。
- **幂等迁移**：`backend/migrations/20250926_0001_logistics_custom_init.sql`（PostgreSQL 16+）。
- **可插拔**：仅修改本模块的 `config/menu.register.yaml` 即可在导航出现，无需改全局代码。

## 路径
- 页面：`/logistics/custom`
- API：`/api/logistics/custom`（参见源码注释）

## 一行日志命令
- **Docker Compose 日志**：`docker compose -f deploy/docker-compose.yml logs web --tail=200`
- **systemd 日志**：`journalctl -u minipost.service -e -n 200`
- **Nginx 错误日志**：`tail -n 200 /var/log/nginx/error.log`

## 注意
- 数据模型与命名严格遵循 SSoT（`minipost_Field V1.1.yaml`）。
- 模块只依赖环境变量 `PG_HOST/PG_PORT/PG_DB/PG_USER/PG_PASSWORD` 建立连接；与全局 ORM 解耦。
- 如全局已存在 Enum `status_common/transport_mode` 或审计表 `audit_log`，本模块自动复用；不存在则不影响主流程。
