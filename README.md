# Minipost（换单服务器 / 新UI骨架版）

> 技术栈：FastAPI + Jinja2 + Uvicorn（Linux systemd 常驻）  
> 目标：**保留旧功能接口**（`/api/v1/version`、`/api/v1/mapping`、`/api/v1/file/{tracking}`、`/api/v1/runtime/sumatra`），
> 并将**后台管理端**替换为你提供的 UI 模块化骨架（拆分 CSS/JS，保留交互）。

## 一键部署（在线）
推荐直接使用你提供的命令：

```bash
bash <(curl -fsSL   -H "Authorization: Bearer $GITHUB_TOKEN"   -H "Accept: application/vnd.github.v3.raw"   "https://api.github.com/repos/aidaddydog/minipost/contents/scripts/bootstrap_online.sh?ref=main")
```

> **说明**：脚本会安装依赖、创建虚拟环境、生成并启用 `minipost.service`，默认监听 `0.0.0.0:8000`。

### 常用命令

- 查看服务状态：`systemctl status minipost.service`
- 查看实时日志：`journalctl -u minipost.service -e -n 200 -f`
- 升级（覆盖式更新）：把新 zip 覆盖到仓库后：`sudo -i && cd /opt/minipost && bash scripts/install_root.sh`
- 卸载清理：`sudo -i && bash /opt/minipost/scripts/uninstall_clean.sh`

## 项目结构
```
minipost/
├─ app/
│  ├─ main.py                # FastAPI 应用入口（模板/静态/路由装配）
│  ├─ api/                   # API（包含 v1，兼容客户端）
│  ├─ services/              # 业务服务层（占位）
│  ├─ models/                # ORM / Pydantic（占位）
│  ├─ core/                  # 配置、日志、中间件
│  └─ templates/             # Jinja2 页面骨架（模块化）
│     ├─ _base/              # 头部/导航/页签/底栏切片
│     ├─ admin/              # 管理端页面（新 UI 壳）
│     └─ auth/               # 登录页
├─ static/                   # 拆分后的 CSS / JS / 资源
│  ├─ css/variables.css      # 统一 :root 变量（可覆盖）
│  ├─ css/base.css           # Reset & 基础类
│  ├─ css/admin.css          # 管理端样式（从 UI 拆分）
│  ├─ js/core/               # 公共交互（胶囊导航/页签/下拉/弹窗等）
│  ├─ js/pages/              # 页面级脚本（如面单列表/上传记录）
│  └─ js/utils/              # 通用工具（虚拟滚/复制/时间控件）
├─ scripts/
│  ├─ bootstrap_online.sh    # 在线一键部署（本仓库）
│  ├─ install_root.sh        # 安装/更新（支持二次覆盖与备份）
│  ├─ uninstall_clean.sh     # 卸载清理
│  └─ systemd/minipost.service
├─ config/
│  ├─ settings.example.env   # 环境变量样例
│  └─ logging.ini            # 文件/控制台双通道日志
├─ updates/                  # 客户端升级包挂载位置（/updates/<ver>/bundle.zip）
├─ .deploy.env               # 部署默认参数（可被覆盖）
├─ requirements.txt
└─ README.md
```

## 兼容的客户端接口
- `GET  /api/v1/version?code=xxxx`
- `GET  /api/v1/mapping?code=xxxx`
- `GET  /api/v1/file/{tracking}?code=xxxx`
- `GET  /api/v1/runtime/sumatra?arch=win64|win32&code=xxxx`

> `runtime/` 下需要放置 `SumatraPDF-*.exe`，否则会返回 404（保留客户端兜底下载逻辑）。

## 二次覆盖更新
- 脚本会按时间戳自动备份到 `/opt/minipost-backups/`。  
- 配置文件：`.deploy.env`、`config/settings.example.env` 可按需覆盖。

## 日志与排错
- 应用日志：`/var/log/minipost/app.log`
- 安装日志：`/var/log/minipost/install-root-*.log`
- 启动失败：`journalctl -u minipost.service -e -n 200`

