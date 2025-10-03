import React from "react";
import ReactDOM from "react-dom/client";
import "../styles/index.css";            // 全局样式入口（含我们导入的 root.css）
import { YamlRouter } from "./YamlRouter";

// 从你的层管理器导出 Provider（该模块已存在；报错信息就来自这里）
import { LayerProvider } from "./LayerManager";

// 不包 StrictMode，避免首屏双渲染导致的闪烁/卡顿
ReactDOM.createRoot(document.getElementById("root")!).render(
  <LayerProvider>
    <YamlRouter />
  </LayerProvider>
);
