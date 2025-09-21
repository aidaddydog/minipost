# minipost（全量替换版骨架）

本仓库基于你提供的 UI 与旧版服务器逻辑重构为模块化结构（FastAPI）：
- `app/models/`：SQLAlchemy 模型（从旧版迁移）
- `app/services/`：业务服务（映射/文件/元数据/认证）
- `app/api/`：对外 API + 管理端页面（新 UI）
- `app/templates/`：Jinja2 页面骨架（新 UI）
- `static/`：样式与脚本（从 UI 拆分）
- `scripts/`：一键部署/卸载与 systemd
- `updates/`：客户端升级包挂载目录

## 一键部署
```bash
bash <(curl -fsSL \
  -H "Authorization: Bearer ${GITHUB_TOKEN:-}" \
  -H "Accept: application/vnd.github.v3.raw" \
  "https://api.github.com/repos/aidaddydog/minipost/contents/scripts/bootstrap_online.sh?ref=main")
```

> 兼容旧变量：如未设置 `MINIPOST_DATA` 将回退使用 `/opt/huandan-data`。

## 二次覆盖更新
只需 `git pull` 后再次执行 `scripts/install_root.sh`，systemd 将平滑重启。

## 日志调取
- 安装日志：`/var/log/minipost/install-*.log`
- 运行日志：`journalctl -u minipost.service -e -n 200`
