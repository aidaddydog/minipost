# minipost（换单服务器 - 新UI骨架全量替换版）

> 技术栈：FastAPI + SQLAlchemy + Jinja2 + SQLite + Uvicorn
> 目标：**一次性替换旧版 HTML 管理端**，保留原有业务/数据库/接口（客户端 API 不变），并将 UI 升级为你提供的胶囊导航/三级页签风格。

## 快速开始（开发）
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp -n config/settings.example.env .deploy.env  # 填写后端端口/路径等
python -m uvicorn app.main:app --reload --port 8000
# 打开 http://localhost:8000/admin
```

## 一键部署（生产）
部署脚本路径与参数保持与你提供的命令兼容：
```bash
bash <(curl -fsSL \  -H "Authorization: Bearer <YOUR_GITHUB_TOKEN>" \  -H "Accept: application/vnd.github.v3.raw" \  "https://api.github.com/repos/aidaddydog/minipost/contents/scripts/bootstrap_online.sh?ref=main")
```
> **说明**：该脚本会安装依赖、创建虚拟环境、写入 systemd 单元 `minipost.service`、放行 UFW 端口并启动服务。

## 兼容性与迁移策略
- **数据库**：默认继续使用旧版 SQLite 文件名 `huandan.sqlite3`（位于仓库根目录），你也可以通过环境变量 `DB_URL` 指向外部库；首次启动会自动建表（含新增 `upload_logs` / `voided_items`）。
- **客户端 API 兼容**：保留旧版 `/api/v1/version`、`/api/v1/mapping`、`/api/v1/file/{tracking_no}`、`/api/v1/runtime/sumatra` 等接口路径不变。
- **管理端数据流**：
  - **订单导入（3 步）**：仍保留 `/admin/upload-orders-step1/2/3`（表单流），同时新增 JSON API：`POST /api/v1/orders/import` 支持直接上传并提交映射列，方便新 UI 一次完成。
  - **面单上传/映射批处理**：`POST /api/v1/labels/import`（ZIP/PDF），`POST /api/v1/labels/import-mapping`（CSV/XLSX）。
  - **模板编辑（读写）**：`GET /api/v1/templates`、`GET /api/v1/templates/content`、`POST /api/v1/templates/save`。
  - **上传记录**：`GET /api/v1/labels/logs` 返回分页的成功/失败号段，`POST /api/v1/labels/logs/copy` 服务器端可生成文本（也支持前端直接复制）。

## 目录
```
minipost/
├─ app/
│  ├─ main.py
│  ├─ api/
│  │  ├─ __init__.py
│  │  ├─ admin_pages.py      # Jinja 页面
│  │  └─ v1/
│  │     ├─ __init__.py
│  │     ├─ labels.py
│  │     ├─ orders.py
│  │     ├─ templates_api.py
│  │     └─ misc.py
│  ├─ services/
│  │  ├─ labels_service.py
│  │  ├─ orders_service.py
│  │  ├─ templates_service.py
│  │  └─ misc_service.py
│  ├─ models/
│  │  ├─ base.py
│  │  ├─ tables.py
│  │  └─ schemas.py
│  ├─ core/
│  │  ├─ config.py
│  │  ├─ deps.py
│  │  └─ security.py
│  └─ templates/
│     ├─ _base/
│     │  ├─ layout.html
│     │  ├─ head.html
│     │  ├─ nav_level1.html
│     │  ├─ nav_level2.html
│     │  ├─ tabs.html
│     │  └─ footer_bar.html
│     ├─ admin/
│     │  ├─ dashboard.html
│     │  ├─ label_upload_list.html
│     │  ├─ label_upload_logs.html
│     │  ├─ templates_list.html
│     │  └─ update.html
│     └─ auth/
│        └─ login.html
├─ static/
│  ├─ css/
│  │  ├─ variables.css
│  │  ├─ base.css
│  │  └─ admin.css
│  ├─ js/
│  │  ├─ admin_bundle.js
│  │  ├─ core/
│  │  │  ├─ nav_capsule.js
│  │  │  ├─ tabs_ink.js
│  │  │  ├─ dropdown.js
│  │  │  ├─ select_enhance.js
│  │  │  └─ modal.js
│  │  ├─ pages/
│  │  │  ├─ label_upload_list.js
│  │  │  ├─ label_upload_logs.js
│  │  │  └─ templates.js
│  │  └─ utils/
│  │     ├─ chunk_render.js
│  │     ├─ time_picker_native.js
│  │     └─ clip.js
│  ├─ fonts/
│  └─ img/
├─ scripts/
│  ├─ bootstrap_online.sh
│  ├─ install_root.sh
│  ├─ uninstall_clean.sh
│  └─ systemd/minipost.service
├─ config/
│  ├─ settings.example.env
│  └─ logging.ini
├─ updates/
├─ .deploy.env
├─ requirements.txt
└─ README.md
```
