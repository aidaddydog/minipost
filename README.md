# minipost · 模块化骨架（nav-shell + 登录独立页 + RBAC）

- 全局导航壳层（视觉与交互**严格对齐**你提供的 UI V1.0，菜单数据动态来自后端合并缓存）。
- 登录模块（独立页面，Cookie-Session）。
- RBAC 核心（用户/角色/权限；接口依赖；菜单按权限过滤）。
- Docker Compose（web + postgres），一键脚本 `scripts/bootstrap_online.sh`。

部署：
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/aidaddydog/minipost/main/scripts/bootstrap_online.sh)
```

更多见 `docs/DEPLOY.md`。
