import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import TopNav from "./components/TopNav";
import SubNav from "./components/SubNav";
import PageTabs from "./components/PageTabs";

type AnyObj = Record<string, any>;

async function ensureNav(): Promise<AnyObj> {
  const cached = (window as any).__navjson;
  if (cached) return cached;
  const res = await fetch("/api/nav", { headers: { Accept: "application/json" }, credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  (window as any).__navjson = json;
  return json;
}

/** 从 /api/nav（新 Schema）派生 L1/L2/L3 结构
 * 仅面向新框架：nav.menu 为对象，nav.tabs 为对象；不再依赖旧 items/children 结构。
 */
function deriveNavModel(nav: AnyObj) {
  const l1: Array<any> = [];
  const l2ByL1: Record<string, any[]> = {};
  const tabsDict: Record<string, any[]> = {};

  // 1) L3 tabs：直接抄给 tabsDict（保持字段名统一：href/title/text/template）
  const fromTabs = (nav && typeof nav === "object" ? (nav as any).tabs : null) || {};
  if (fromTabs && typeof fromTabs === "object") {
    Object.keys(fromTabs).forEach((base) => {
      const arr = (fromTabs as any)[base];
      if (Array.isArray(arr)) {
        tabsDict[base] = arr.map((t: any) => ({
          ...t,
          href: t.href || t.path || "/",
          title: t.title || t.text,
          text: t.text || t.title,
        }));
      }
    });
  }

  // 2) L1/L2：从 nav.menu（对象）构造
  const menuObj = (nav && typeof nav === "object" ? (nav as any).menu : null) || null;

  // 辅助：根据 L2 列表推导 L1 基础路径（/logistics/channel → /logistics）
  const l1PathFromL2List = (l2List: any[]): string => {
    const firstHref = ((l2List?.[0]?.href || l2List?.[0]?.path || "") as string).trim();
    const segs = firstHref.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    return segs.length ? "/" + segs[0] : "/";
  };

  if (menuObj && typeof menuObj === "object" && !Array.isArray(menuObj)) {
    Object.keys(menuObj).forEach((l1Title) => {
      const l2List = (menuObj as any)[l1Title] || [];
      const baseHref = l1PathFromL2List(l2List);
      // L1
      l1.push({ href: baseHref, title: l1Title, text: l1Title });
      // L2
      l2ByL1[baseHref] = Array.isArray(l2List)
        ? l2List.map((c: any) => ({
            ...c,
            href: c.href || c.path || "/",
            title: c.title || c.text,
            text: c.text || c.title,
          }))
        : [];
    });
  }

  return { l1, l2ByL1, tabsDict };
}

export function ShellHeaderSkeleton() {
  return (
    <div className="border-b" style={{ height: "var(--nav-l1-height)" }} />
  );
}

/** 找到与 path 最匹配的 L1 基础路径（最长前缀匹配） */
function resolveActiveL1(pathname: string, l1: Array<{href: string}>) {
  const cand = l1
    .filter((it) => pathname === it.href || pathname.startsWith((it.href || "/") + "/"))
    .sort((a, b) => (b.href?.length || 0) - (a.href?.length || 0));
  return cand[0] || l1[0] || null;
}

/** 依据 L1/L2/tabs 推导“首个可渲染页面”，用于点击锁定后导航 */
function firstRenderableFromL1(l1Href: string, l2ByL1: Record<string, any[]>, tabsDict: Record<string, any[]>) {
  const l2 = l2ByL1[l1Href] || [];
  if (l2.length) {
    const base = l2[0].href || l1Href;
    const t = tabsDict[base] || [];
    if (t.length) return t[0].href || base;
    return base;
  }
  const t = tabsDict[l1Href] || [];
  if (t.length) return t[0].href || l1Href;
  return l1Href;
}

function firstRenderableFromL2(l2Href: string, tabsDict: Record<string, any[]>) {
  const t = tabsDict[l2Href] || [];
  if (t.length) return t[0].href || l2Href;
  return l2Href;
}

export default function ShellLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [model, setModel] = React.useState<ReturnType<typeof deriveNavModel> | null>(null);

  // 交互三态
  const [lockedPath, setLockedPath] = React.useState<string | null>(null);
  const [hoverPath, setHoverPath] = React.useState<string | null>(null);
  const visualPath = hoverPath || lockedPath || pathname; // 可视优先

  // 登录页不渲染外壳
  if (pathname === "/login") {
    return <Outlet />;
  }

  React.useEffect(() => {
    (async () => {
      const navjson = await ensureNav();
      const m = deriveNavModel(navjson);
      setModel(m);
      // 初始锁定：以当前路由归属的 L1 为基准
      const l1Active = resolveActiveL1(pathname, m.l1);
      const first = l1Active ? firstRenderableFromL1(l1Active.href, m.l2ByL1, m.tabsDict) : pathname;
      setLockedPath(first);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 路由变化时，若用户没有 hover，更新锁定到当前归属页
  React.useEffect(() => {
    if (!model) return;
    if (hoverPath) return;
    const l1Active = resolveActiveL1(pathname, model.l1);
    const first = l1Active ? firstRenderableFromL1(l1Active.href, model.l2ByL1, model.tabsDict) : pathname;
    setLockedPath(first);
  }, [pathname, hoverPath, model]);

  // hover 退出的封装（加入宽限期）
  const clearHover = React.useCallback((delay = 80) => {
    if (delay <= 0) setHoverPath(null);
    else setTimeout(() => setHoverPath(null), delay);
  }, []);

  if (!model) {
    return (
      <>
        <ShellHeaderSkeleton />
        <Outlet />
      </>
    );
  }

  // 以“可视路径”推导 L2 与 tabs（实现 hover 预览时 UI 跟随，但不改路由）
  const l1Active = resolveActiveL1(visualPath, model.l1) || model.l1[0];
  const l2 = model.l2ByL1[l1Active?.href || ""] || [];
  const tabs =
    model.tabsDict[visualPath] ||
    model.tabsDict[(l2.find((x: any) => visualPath.startsWith((x.href || "") + "/"))?.href) || ""] ||
    model.tabsDict[l1Active?.href || ""] ||
    [];

  // 点击 L1/L2/tab 的统一导航：锁定并跳转
  const onPickL1 = (href: string) => {
    const dest = firstRenderableFromL1(href, model.l2ByL1, model.tabsDict);
    setLockedPath(dest);
    clearHover(0);
    if (dest !== pathname) navigate(dest);
  };
  const onPickL2 = (href: string) => {
    const dest = firstRenderableFromL2(href, model.tabsDict);
    setLockedPath(dest);
    clearHover(0);
    if (dest !== pathname) navigate(dest);
  };
  const onPickTab = (href: string) => {
    setLockedPath(href);
    clearHover(0);
    if (href !== pathname) navigate(href);
  };

  return (
    <div>
      <TopNav
        items={model.l1}
        activePath={pathname}
        visualPath={visualPath}
        l2ByL1={model.l2ByL1}
        tabsDict={model.tabsDict}
        onHoverL1={setHoverPath}
        onLeaveHeader={() => clearHover(80)}
        onPickL1={onPickL1}
      />

      {/* L2 二级 */}
      {l2.length > 0 && (
        <SubNav
          items={l2}
          activePath={pathname}
          visualPath={visualPath}
          onHoverL2={setHoverPath}
          onLeaveL2={() => clearHover(80)}
          onPickL2={onPickL2}
        />
      )}

      {/* L3 页签 */}
      {tabs.length > 0 && (
        <PageTabs
          tabs={tabs}
          activePath={pathname}
          visualPath={visualPath}
          onPickTab={onPickTab}
        />
      )}

      {/* 主内容 */}
      <div className="px-6 py-4">
        <Outlet />
      </div>
    </div>
  );
}
