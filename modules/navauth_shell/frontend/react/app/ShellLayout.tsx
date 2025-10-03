import React, { useEffect, useMemo, useRef, useState } from "react";
import TopNav, { TopNavHandle, L1Item } from "./components/TopNav";
import SubNav, { L2Item } from "./components/SubNav";
import PageTabs, { TabItem } from "./components/PageTabs";
import { LayerManager } from "./LayerManager";

type MenuMap = Record<string, { text: string; href: string }[]>;
type TabsMap = Record<string, { text: string; href: string; key?: string; template?: string }[]>;

export type NavPayload = { menu: MenuMap; tabs: TabsMap };
type Model = {
  l1: L1Item[];
  l2ByL1: Record<string, L2Item[]>;   // ownerPath -> L2[]
  tabsDict: Record<string, TabItem[]>; // subHref -> tabs[]
};

const SCHEMA_VERSION = 11;
const STORAGE_KEY = "NAV_STATE_V11";

function ownerPathOf(href: string): string {
  try {
    const u = new URL(href, window.location.origin);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length ? ("/" + parts[0]) : "/";
  } catch { return "/"; }
}

function deriveModel(menu: MenuMap, tabs: TabsMap): Model {
  const l1: L1Item[] = [];
  const l2ByL1: Record<string, L2Item[]> = {};
  const seenOwner = new Set<string>();

  for (const [l1Text, l2List] of Object.entries(menu || {})) {
    if (!Array.isArray(l2List) || !l2List.length) continue;
    const firstHref = l2List[0].href || "/";
    const owner = ownerPathOf(firstHref);
    if (!seenOwner.has(owner)) {
      seenOwner.add(owner);
      l1.push({ text: l1Text, path: owner, href: owner });
    }
    l2ByL1[owner] = (l2List || []).map(i => ({ text: i.text, href: i.href, ownerPath: owner }));
  }
  const tabsDict: Record<string, TabItem[]> = {};
  for (const [k, arr] of Object.entries(tabs || {})) {
    tabsDict[k] = (arr || []).map(t => ({ key: t.key, text: t.text, href: t.href }));
  }
  return { l1, l2ByL1, tabsDict };
}

function useNumericVar(name: string, fallback = 0) {
  const [val, setVal] = useState(fallback);
  useEffect(() => {
    const get = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      const num = parseFloat(v); setVal(Number.isFinite(num) ? num : fallback);
    };
    get(); window.addEventListener("resize", get);
    return () => window.removeEventListener("resize", get);
  }, [name, fallback]);
  return val;
}

export default function ShellLayout({ nav }: { nav?: NavPayload }) {
  // 如果外层未传 nav，则自行拉取（避免依赖其它框架文件）
  const [innerNav, setInnerNav] = useState<NavPayload | null>(nav || null);
  useEffect(() => { if (!nav && !innerNav) { fetch("/api/nav").then(r => r.json()).then(setInnerNav).catch(()=>{}); }}, [nav, innerNav]);
  const data = nav || innerNav;
  const model = useMemo(() => data ? deriveModel(data.menu || {}, data.tabs || {}) : null, [data]);

  // 状态持久化
  const [lockedPath, setLockedPath] = useState<string>("/");
  const [lockedSubHref, setLockedSubHref] = useState<string>("");
  const [lockedTabHref, setLockedTabHref] = useState<string>("");
  const [hoverPath, setHoverPath] = useState<string>(lockedPath);
  const [inSubRow, setInSubRow] = useState<boolean>(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && obj.v === SCHEMA_VERSION) {
          setLockedPath(obj.lockedPath || "/");
          setLockedSubHref(obj.lockedSubHref || "");
          setLockedTabHref(obj.lockedTabHref || "");
          setHoverPath(obj.lockedPath || "/");
        }
      } else if (model && model.l1.length) {
        const first = model.l1[0];
        setLockedPath(first.path);
        const sub = (model.l2ByL1[first.path] || [])[0];
        setLockedSubHref(sub ? sub.href : "");
      }
    } catch {}
  }, [model?.l1.length]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: SCHEMA_VERSION, lockedPath, lockedSubHref, lockedTabHref, ts: Date.now() }));
    } catch {}
  }, [lockedPath, lockedSubHref, lockedTabHref]);

  // 计算当前子菜单 & 页签
  const l2List = useMemo<L2Item[]>(() => (model ? (model.l2ByL1[hoverPath || lockedPath] || []) : []), [model, hoverPath, lockedPath]);
  const tabs = useMemo<TabItem[]>(() => (model ? (model.tabsDict[lockedSubHref] || []) : []), [model, lockedSubHref]);

  // Pill 联动（让二级 hover 时可推动一级胶囊）
  const topRef = useRef<TopNavHandle | null>(null);

  // 点击 L1 => 锁定并跳首个 L2
  function lockPath(p: string) {
    setLockedPath(p);
    setHoverPath(p);
    const first = (model?.l2ByL1[p] || [])[0];
    setLockedSubHref(first ? first.href : "");
    const tabs0 = first ? (model?.tabsDict[first.href] || []) : [];
    setLockedTabHref(tabs0.length ? (tabs0[0].href) : "");
  }

  function lockSub(href: string) {
    setLockedSubHref(href);
    const t = model?.tabsDict[href] || [];
    setLockedTabHref(t.length ? t[0].href : "");
  }

  function lockTab(href: string) { setLockedTabHref(href); }

  const pagePadPx = useNumericVar("--page-px", 50);

  if (!model) return <div className="shell">加载导航中…</div>;

  return (
    <LayerManager>
      <div className="shell">
        {/* 顶部：Logo / 导航卡片 / 头像 */}
        <div className="shell-header">
          <a className="logo" href="/admin" aria-label="仪表盘"></a>
          <div className="header-gap-left" aria-hidden="true" />
          <TopNav
            ref={topRef}
            items={model.l1}
            lockedPath={lockedPath}
            hoverPath={hoverPath}
            inSubRow={inSubRow}
            onHoverPath={setHoverPath}
            onLockPath={lockPath}
          />
          <div className="header-gap-right" aria-hidden="true" />
          <div className="avatar" aria-label="头像"></div>
        </div>
      </div>

      {/* 二级整行（固定视角区域） */}
      <SubNav
        owner={model.l1.find(i => i.path === (hoverPath || lockedPath)) || null}
        items={l2List}
        lockedSubHref={lockedSubHref}
        topNavRef={topRef}
        onLockSub={lockSub}
        onPointerZone={setInSubRow}
      />

      {/* 三级页签（Ink 线仅点击动画） */}
      <PageTabs
        tabs={tabs}
        lockedTabHref={lockedTabHref}
        onLockTab={lockTab}
      />

      {/* 留给页面内容的外层容器（左右与设计稿一致） */}
      <div style={{ maxWidth: "var(--maxw)", margin: "0 auto", padding: `0 ${pagePadPx}px` }}>
        {/* 下方页面内容由各模块 React 页面渲染 */}
      </div>
    </LayerManager>
  );
}
