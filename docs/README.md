# minipost

本仓库交付内容：
- 导航壳（nav_shell）页面与交互（像素/动效一致），DOM/CSS 变量名照原稿复刻，JS 行为完全一致（含“宽容时间窗”“三级墨线”）。参考来源：用户提供 `nav_shell.html` 原稿（仅作为像素与动效规范的基线）。
- 登录模块（独立页）与最小可用 RBAC（用户/角色/权限）。
- 聚合导航 API（自动汇总 `modules/*/config/menu.register.yaml`）与健康探针。模块热插拔仅改 YAML 即生效。
- 一键部署（Preflight→自动安装 Docker/Compose→强制 PostgreSQL16→迁移→初始化管理员→健康检查→结果输出）。
- 主题机制：所有 `:root` tokens 集中在 `modules/_themes/default/root.css`，组件样式与交互分别在 `nav_shell.css/js`，达成“改 CSS 即换肤”。

**像素级复刻依据**：本项目的 DOM 层级、CSS Design Tokens、动效节奏严格对齐用户提供的原稿 `nav_shell.html`（我们已抽出 :root，并将组件样式与交互文件化）。fileciteturn0file0

**字段与命名规范（SSOT）**：系统字段/命名/时间/金额/单位等标准严格参照 `minipost_Field V1.1.yaml`，不含任何被排除业务字段。fileciteturn0file1

> ⚠️ 本轮范围内明确排除“面单上传/物流上传”模块及其任何文件、菜单、脚本与占位。
