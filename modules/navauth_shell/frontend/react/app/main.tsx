import React from "react";
import ReactDOM from "react-dom/client";
import "../styles/index.css";            // ← 全局样式入口（含 root.css）
import { YamlRouter } from "./YamlRouter";

// 为避免登录页/首屏的重复 effect 造成闪烁/卡顿，这里不包 StrictMode
ReactDOM.createRoot(document.getElementById("root")!).render(<YamlRouter />);
