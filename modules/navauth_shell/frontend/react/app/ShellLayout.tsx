import React, { Fragment, useEffect, useMemo, useState } from "react";
import { loadNav } from "./navApi";
import type { NavModel } from "./types";
import { TopNav } from "./TopNav";
import { LayerManager } from "./LayerManager";

export const ShellLayout: React.FC = () => {
  const [model, setModel] = useState<NavModel>({ l1: [], l2ByL1: {}, tabsDict: {} });

  useEffect(() => {
    let mounted = true;
    loadNav().then((m) => { if (mounted) setModel(m); });
    return () => { mounted = false; };
  }, []);

  const pathname = useMemo(() => (typeof window !== "undefined" ? window.location.pathname : "/"), []);

  return (
    <LayerManager>
      <div className="shell">
        <div className="header">
          <a className="logo" href="/admin" aria-label="仪表盘"></a>
          <div className="header-gap-left" aria-hidden="true"></div>

          {/* 顶部主导航（无数据时仅空轨道，不显示占位文案） */}
          <TopNav items={model.l1} activePath={pathname} />

          <div className="header-gap-right" aria-hidden="true"></div>
          <div className="avatar" aria-label="头像"></div>
        </div>
      </div>
      {/* 说明：当前按你的要求，只保留登录 + 顶部导航 + 基座，不渲染 L2/L3 行 */}
    </LayerManager>
  );
};
