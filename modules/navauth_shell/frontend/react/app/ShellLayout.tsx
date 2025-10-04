import React from "react";
import { loadNav } from "./navApi";
import type { NavModel } from "./types";
import { TopNav } from "./TopNav";
import { LayerManager } from "./LayerManager";

export const ShellLayout: React.FC = () => {
  const [model, setModel] = React.useState<NavModel>({ l1: [], l2ByL1: {}, tabsDict: {} });
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";

  React.useEffect(() => {
    let mounted = true;
    loadNav().then((m) => mounted && setModel(m));
    return () => { mounted = false; };
  }, []);

  return (
    <LayerManager>
      <div className="min-h-screen">
        <div className="header mx-auto" style={{ maxWidth: 1280, padding: "16px 0" }}>
          <a className="logo" href="/" aria-label="仪表盘" />
          <div className="header-gap-left" aria-hidden="true" />
          <TopNav items={model.l1} activePath={pathname} />
          <div className="header-gap-right" aria-hidden="true" />
          <div className="avatar" aria-label="头像" />
        </div>
      </div>
    </LayerManager>
  );
};
