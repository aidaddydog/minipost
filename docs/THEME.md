# THEME

- 仅允许在 `modules/_themes/<theme>/root.css` 中出现 `:root{ --token }`。
- 壳层组件样式写在 `modules/navauth_shell/frontend/static/nav_shell.css`（不得含 `:root`）。
- 交互与动效写在 `modules/navauth_shell/frontend/static/nav_shell.js`。

换肤方式：复制 `modules/_themes/default` 为新主题文件夹，修改其中的 tokens 即可全局换肤（壳层）。
