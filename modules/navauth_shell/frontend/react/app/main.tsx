import React from "react";
import { createRoot } from "react-dom/client";
import { ShellLayout } from "./ShellLayout";
import "../styles/index.css";

/** 默认导出的登录页组件 */
import AuthLoginPage from "../../../../auth_login/frontend/react/pages/auth_login";

/**
 * 单入口：根据当前路径选择渲染
 * - /login → 登录页（不走壳层导航）
 * - 其它路径 → 壳层（LOGO+导航+头像；L1/L2/L3 由后端 /api/nav 的 YAML 聚合）
 */
const mount = document.getElementById("root");

if (mount) {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  const isLogin = path === "/login";

  createRoot(mount).render(isLogin ? <AuthLoginPage /> : <ShellLayout />);
}
