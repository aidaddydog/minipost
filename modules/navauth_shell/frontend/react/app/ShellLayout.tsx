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

/** 从 /api/nav（新 Schema）派生 L1/L2/L3 结构 */
function deriveNavModel(nav: AnyObj) {
  const l1: Array<any> = [];
  const l2ByL1: Record<string, any[]> = {};
  const tabsDict: Record<string, any[]> = {};

  // tabs → tabsDict
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

  // menu（对象）→ l1 / l2ByL1
  const menuObj = (nav && typeof nav === "object" ? (nav as any).menu : null) || null;
  const l1PathFromL2List = (l2List: any[]): string => {
    const firstHref = ((l2List?.[0]?.href || l2List?.[0]?.path || "") as string).trim();
    const segs = firstHref.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    return segs.length ? "/" + segs[0] : "/";
  };
  if (menuObj && typeof menuObj === "object" && !Array.isArray(menuObj)) {
    Object.keys(menuObj).forEach((l1Title) => {
      const l2List = (menuObj as any)[l1Title] || [];
      const baseHref = l1PathFromL2List(l2List);
      l1.push({ href: baseHref, title: l1Title, text: l1Title });
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
  return <div className="border-b" style={{ height: "var(--nav-l1-height)" }} />;
}

function resolveActiveL1(pathname: string, l1: Array<{href: string}>) {
  const cand = l1
    .filter((it) => pathname === it.href || pathname.startsWith((it.href || "/") + "/"))
    .sort((a, b) => (b.href?.length || 0) - (a.href?.length || 0));
  return cand[0] || l1[0] || null;
}

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

  const [lockedPath, setLockedPath] = React.useState<string | null>(null);
  const [hoverPath, setHoverPath] = React.useState<string | null>(null);
  const visualPath = hoverPath || lockedPath || pathname;

  if (pathname === "/login") {
    return <Outlet />;
  }

  React.useEffect(() => {
    (async () => {
      const navjson = await ensureNav();
      const m = deriveNavModel(navjson);
      setModel(m);
      const l1Active = resolveActiveL1(pathname, m.l1);
      const first = l1Active ? firstRenderableFromL1(l1Active.href, m.l2ByL1, m.tabsDict) : pathname;
      setLockedPath(first);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!model) return;
    if (hoverPath) return;
    const l1Active = resolveActiveL1(pathname, model.l1);
    const first = l1Active ? firstRenderableFromL1(l1Active.href, model.l2ByL1, model.tabsDict) : pathname;
    setLockedPath(first);
  }, [pathname, hoverPath, model]);

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

  const l1Active = resolveActiveL1(visualPath, model.l1) || model.l1[0];
  const l2 = model.l2ByL1[l1Active?.href || ""] || [];
  const tabs =
    model.tabsDict[visualPath] ||
    model.tabsDict[(l2.find((x: any) => visualPath.startsWith((x.href || "") + "/"))?.href) || ""] ||
    model.tabsDict[l1Active?.href || ""] ||
    [];

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

      {tabs.length > 0 && (
        <PageTabs
          tabs={tabs}
          activePath={pathname}
          visualPath={visualPath}
          onPickTab={onPickTab}
        />
      )}

      <div className="px-6 py-4">
        <Outlet />
      </div>
    </div>
  );
}
