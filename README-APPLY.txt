应用说明（minipost 导航复刻补丁）
=================================
覆盖范围：
- modules/navauth_shell/frontend/react/app/ShellLayout.tsx
- modules/navauth_shell/frontend/react/app/components/TopNav.tsx
- modules/navauth_shell/frontend/react/app/components/SubNav.tsx
- modules/navauth_shell/frontend/react/app/components/PageTabs.tsx
- modules/navauth_shell/frontend/react/styles/_nav_effects.css  （新增文件，需在 index.css 末尾 @import）
- modules/_themes/default/_63_vars_patch.css                    （新增文件，已含动画与 pill/ink 变量）

手工合并步骤：
1) 在 `modules/navauth_shell/frontend/react/styles/index.css` 末尾新增：
   @import "../../../../_themes/default/_63_vars_patch.css";
   @import "./_nav_effects.css";

2) 用本补丁中的 4 个 TSX 文件，覆盖仓库同路径文件。

3) 构建与重启：
   docker compose -f deploy/docker-compose.yml build web
   systemctl restart minipost.service

4) 验证交互：
   - /login 正常渲染登录页；登录后：
   - 顶部 L1：hover 跟随 pill，离开回弹；点击锁定并跳到首个可渲染 tab；
   - 二级 L2：hover 预览对应 tabs；点击锁定并跳到首个 tab；
   - 三级 tabs：Ink 跟随文字宽度位移动画；
   - 视口变化/横向滚动时，pill/ink 均能正确复位。

注意：不改动 Dockerfile/后端/脚本，确保一键部署顺畅。
