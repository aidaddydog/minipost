import React from "react";
import ReactDOM from "react-dom/client";
import "../styles/index.css";            // 全局样式入口（含 root.css）
import { YamlRouter } from "./YamlRouter";

// 正确路径：LayerManager 位于 systems 目录
import { LayerProvider } from "./systems/LayerManager";

// 不包 StrictMode，避免首屏双渲染导致的闪烁
ReactDOM.createRoot(document.getElementById("root")!).render(
  <LayerProvider>
    <YamlRouter />
  </LayerProvider>
);
