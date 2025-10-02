# SECURITY

- 容器内服务以非 root 用户运行（Dockerfile 中 `USER appuser`）。
- 数据库强制 PostgreSQL 16（容器化、健康检查、持久化卷）。
- 一键部署脚本全流程要求宿主机 root（EUID==0），检测到非 root 立即退出。
- 登录使用 JWT（HS256），HTTPOnly Cookie；登出删除 Cookie；Token 过期可配置。
- RBAC 最小可用：用户/角色/权限 + 绑定关系；敏感字段不落盘日志；`.deploy.env` 由脚本写入强口令与随机密钥。
