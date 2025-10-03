import React, { Fragment, useEffect, useMemo, useState } from "react";
import { loadNav } from "./navApi";
import type { NavModel } from "./types";
import { TopNav } from "./TopNav";
import { LayerManager } from "./LayerManager";

/**
 * 壳层：无论是否已经有模块，始终渲染 LOGO + 顶部导航轨道 + 头像。
 * 菜单数据来自 /api/nav（由 YAML 聚合），没有模块时 items 为空数组。
 */
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
          {/* 统一标准：LOGO 点击 → "/" */}
          <a className="logo" href="/" aria-label="仪表盘"></a>
          <div className="header-gap-left" aria-hidden="true"></div>

          {/* 顶部主导航（无数据时仅空轨道，不显示占位文案） */}
          <TopNav items={model.l1} activePath={pathname} />

          <div className="header-gap-right" aria-hidden="true"></div>
          <div className="avatar" aria-label="头像"></div>
        </div>
      </div>
      {/* 壳层只负责顶部；L2/L3 由后续模块扩展 */}
    </LayerManager>
  );
};
