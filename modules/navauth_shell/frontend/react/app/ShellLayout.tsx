import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import TopNav from "./components/TopNav";
import SubNav from "./components/SubNav";
import PageTabs from "./components/PageTabs";

type AnyObj = Record<string, any>;

async function ensureNav(): Promise<AnyObj> {
  const cached = (window as any).__navjson;
  if (cached) return cached;
  const res = await fetch("/api/nav", { headers: { Accept: "application/json" }, credentials: "include" });
  const json = await res.json();
  (window as any).__navjson = json;
  return json;
}

/** 从 /api/nav 派生 L1/L2/L3 结构（容错：兼容 menu/items/tabs 多种写法） */
function deriveNavModel(nav: AnyObj) {
  // L1/ L2
  const l1: Array<any> = [];
  const l2ByL1: Record<string, any[]> = {};
  const rootMenus = (nav.menus || nav.menu || nav.items || []) as any[];
  const arr = Array.isArray(rootMenus) ? rootMenus : [];

  arr.forEach((it) => {
    const href = it.href || it.path || "/";
    const item = { ...it, href };
    l1.push(item);
    const children = it.children || it.items || [];
    l2ByL1[href] = Array.isArray(children)
      ? children.map((c: any) => ({ ...c, href: c.href || c.path || "/" }))
      : [];
  });

  // L3 tabs：有的放在 nav.tabs，有的在具体菜单项内部
  const tabsDict: Record<string, any[]> = {};
  const fromNavTabs = nav.tabs || {};
  if (fromNavTabs && typeof fromNavTabs === "object") {
    Object.keys(fromNavTabs).forEach((base) => {
      const arr2 = fromNavTabs[base];
      if (Array.isArray(arr2)) {
        tabsDict[base] = arr2.map((t: any) => ({ ...t, href: t.href || t.path || "/" }));
      }
    });
  }
  // 再从 l2 里合并（如果有）
  l1.forEach((one) => {
    const base = one.href;
    (l2ByL1[base] || []).forEach((sec) => {
      const key = sec.href || base;
      const t = (sec.tabs || []) as any[];
      if (t.length) {
        tabsDict[key] = t.map((x) => ({ ...x, href: x.href || x.path || "/" }));
      }
    });
  });

  return { l1, l2ByL1, tabsDict };
}

export function ShellHeaderSkeleton() {
  return (
    <div className="border-b" style={{ height: "var(--nav-l1-height)" }} />
  );
}

export function ShellLayout() {
  const loc = useLocation();
  const [model, setModel] = React.useState<ReturnType<typeof deriveNavModel> | null>(null);

  React.useEffect(() => {
    (async () => {
      const nav = await ensureNav();
      setModel(deriveNavModel(nav));
    })();
  }, []);

  if (!model) {
    return (
      <>
        <ShellHeaderSkeleton />
        <Outlet />
      </>
    );
  }

  const pathname = loc.pathname || "/";
  // 当前激活 L1：以最长前缀匹配
  const activeL1 = model.l1
    .filter((m) => pathname === m.href || pathname.startsWith(m.href + "/"))
    .sort((a, b) => (b.href?.length || 0) - (a.href?.length || 0))[0] || model.l1[0];

  const l2 = model.l2ByL1[activeL1?.href || ""] || [];

  // 选用的 L3：优先匹配到 L2 的 base，再退回 L1 base
  const tabs =
    model.tabsDict[pathname] ||
    model.tabsDict[(l2.find((x) => pathname.startsWith(x.href + "/"))?.href) || ""] ||
    model.tabsDict[activeL1?.href || ""] ||
    [];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* L1 顶栏 */}
      <TopNav items={model.l1} activePath={pathname} />

      {/* L2 二级 */}
      {l2.length > 0 && <SubNav items={l2} activePath={pathname} />}

      {/* L3 页签 */}
      {tabs.length > 0 && <PageTabs tabs={tabs} activePath={pathname} />}

      {/* 主内容 */}
      <div className="px-6 py-4">
        <Outlet />
      </div>
    </div>
  );
}

export default ShellLayout;
