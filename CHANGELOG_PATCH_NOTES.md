# Minipost 基座修复补丁（2025-10-03）

本补丁聚焦修复“迁移与 ORM 元数据对齐、导航缓存预热、未登录跳转、Cookie 安全属性、模板路径白名单、开发 CORS”六个方面，尽量在**不改变现有行为**前提下完成增强。

## 变更摘要
- **Alembic 元数据导入**：在 `migrations/env.py` 与 `migrations/versions/0001_init_rbac.py` 中加入 `("app.common.models_base", "Base")` 候选，确保迁移阶段能够发现项目的 `Base.metadata` 并用 ORM 的表定义创建/比较。
- **启动预热真正写入缓存**：`app/main.py` 启动事件改为调用 `app.common.utils.refresh_nav_cache()`；`scripts/reload_nav.sh` 使用同一函数，保证 `/api/nav` 首次可用。
- **未登录访问自动跳转**：前端 `modules/navauth_shell/.../navApi.ts` 增加 401 处理，跳转至 `/login?next=...`。
- **Cookie 安全属性按环境**：登录接口在生产环境下启用 `secure=True`（`settings.ENVIRONMENT == "production"`）。
- **模板路径白名单**：仅允许渲染 `modules/**/frontend/templates` 下的模板，非法路径一律回落到 SPA。
- **开发 CORS**：非生产环境允许 `http://localhost:5173` 跨域，便于本地前后端联调。
- **工具链兼容**：新增 `app/__init__.py` 与 `modules/__init__.py`，提升工具链（如 Alembic）路径发现的稳定性。

## 注意
- `app/bootstrap.py` 中保留了 `RBACBase.metadata.create_all()` 作为兜底（幂等），与迁移不冲突。
- 本补丁不更改数据库表名（仍以 ORM 定义为准），迁移脚本会优先通过 `Base.metadata` 创建一致的表结构。

## 2025-10-04 00:05:43 （增量优化 ×2）
- scripts/reload_nav.sh：增强 docker 运行环境探测，兼容 **docker compose** 与 **docker-compose** 两种方式，无法检测时回落为本机 Python 调用。
- requirements.txt：将 **sqlalchemy** 固定为 **2.0.35**，便于环境重现与问题回溯（不改变其它依赖）。
