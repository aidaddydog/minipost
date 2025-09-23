# minipost UI 覆盖包（2025-09-23）

本覆盖包完成：
- 将 `docs/minipost_UI V1.0` 的页面拆分为 **Vue 3 + Vite** 组件；视觉与交互保持一致。
- 新增并打通 **真实字段 `transport_mode`（运输方式）**，后端模型/迁移/接口/前端同步。
- 一键部署脚本 `scripts/bootstrap_online.sh` 全量实现（可直接远程执行）。
- 前端路由保持：`/orders/label-upload/list` & `/orders/label-upload/logs`。

## 覆盖步骤（本地或服务器均可）

> ⚠️ 请确认你已备份或使用 Git 分支。执行以下命令会覆盖仓库同名文件。

```bash
# 在你的仓库根目录执行：
unzip -o minipost-vue-overlay.zip -d .

# 提交到 Git（例如 main 分支）：
git add -A
git commit -m "feat(ui): huandan UI V1.0 组件化 + transport_mode + 1key"
git push origin main

# 一键部署（远端脚本会使用最新 main）：
bash <(curl -fsSL https://raw.githubusercontent.com/aidaddydog/minipost/main/scripts/bootstrap_online.sh)
```

## 主要改动点

- **后端**：
  - `Waybill.transport_mode: Enum`（与字段表一致）
  - `LabelRow` 增加 `transport_mode` 并在列表接口返回
  - Alembic 迁移：自动增加列，兼容旧库
- **前端**：
  - 完整复制 UI 变量/样式（`huandan-ui.css`）
  - `OrderManagement.vue` 重构为三行壳：顶部导航 → 二级导航 → 三级页签 + 卡片
  - 列表列名与字段：订单号、运单号、转单号、**运输方式**、面单、状态、时间
  - “上传记录”页内嵌弹窗查看成功 / 失败清单并一键复制

> 字段标准参见：`docs/minipost_Field V1.1.yaml`（本覆盖包严格对齐）。

