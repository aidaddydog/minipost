# v96 导航聚合 & 登录 CSS 修复补丁（前端/静态文件，稳定不改后端/容器脚本）

本补丁专门解决：
1) 登录页面无样式 —— 提供 `app/static/root.css`，容器构建时会被 `COPY . /app` 自动拷入并由现有静态路由暴露为 `/static/root.css`。
2) “自定义物流 / 系统更新” 未聚合 —— 为两个模块补齐 `modules/**/config/*.yaml`（menu/tabs/module.meta/permissions），符合 **/api/nav** 的聚合规则（按 L2 的 `href` 前缀自动归入 `/logistics` 与 `/settings`）。
3) React 导航实现 —— 保持“React + shadcn/ui + Fragment + Portal + 单一 LayerManager”的结构，不依赖旧时代 `items/children` 逻辑。

## 覆盖文件清单（仅前端/静态/YAML）
- app/static/root.css
- modules/_themes/default/root.css
- modules/_themes/default/_63_vars_patch.css
- modules/navauth_shell/frontend/react/styles/index.css
- modules/navauth_shell/frontend/react/styles/_nav_effects.css
- modules/navauth_shell/frontend/react/app/LayerManager.tsx
- modules/navauth_shell/frontend/react/app/ShellLayout.tsx
- modules/navauth_shell/frontend/react/app/components/TopNav.tsx
- modules/navauth_shell/frontend/react/app/components/SubNav.tsx
- modules/navauth_shell/frontend/react/app/components/PageTabs.tsx
- modules/logistics_custom/config/{module.meta.yaml,menu.register.yaml,tabs.register.yaml,permissions.register.yaml}
- modules/system_update/config/{module.meta.yaml,menu.register.yaml,tabs.register.yaml,permissions.register.yaml}

## 应用步骤
1) 解压覆盖到仓库根目录（如 /opt/minipost）
   unzip -o /mnt/data/minipost_v96_nav_fix_patch.zip -d /opt/minipost

2) 重建 Web 镜像并重启服务（不改容器脚本/镜像结构）
   docker compose -f /opt/minipost/deploy/docker-compose.yml build web
   systemctl restart minipost.service

3) 验证
   - 登录页应加载 `/static/root.css`（浏览器网络面板可见），字体/按钮恢复样式；
   - `/api/nav` 数据应包含：`/logistics/custom` 与 `/settings/system-update` 对应的 L2；
   - 顶部 L1 胶囊、L2 文本条、L3 页签（含 Ink 线）正常，交互与设计稿一致；
   - 仅通过 YAML 新增模块即可出现在导航中，无需写 TS 适配。

注意：本补丁不修改 Python/后端逻辑、不修改 Dockerfile 与部署脚本，确保系统基座稳定。
