import React from "react";
import {
  createBrowserRouter,
  RouterProvider,
  RouteObject,
  Navigate,
} from "react-router-dom";
import ShellLayout from "./ShellLayout";

function NotFound() {
  return <div className="p-6 text-sm text-slate-600">页面不存在或尚未迁移。</div>;
}

type AnyObj = Record<string, any>;
type TabLike = { href?: string; template?: string; title?: string };

/** 拉取并缓存导航 JSON */
async function fetchNav(): Promise<AnyObj> {
  const cached = (window as any).__navjson;
  if (cached) return cached;
  const res = await fetch("/api/nav", { headers: { Accept: "application/json" }, credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  (window as any).__navjson = json;
  return json;
}

function flattenTabs(root: AnyObj): TabLike[] {
  const out: TabLike[] = [];
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    const href = node.href || node.path;
    if (href && typeof href === "string") out.push({ href, template: node.template, title: node.title });
    if (Array.isArray(node.tabs)) node.tabs.forEach(walk);
    else if (node.tabs && typeof node.tabs === "object")
      Object.values(node.tabs).forEach((arr: any) => Array.isArray(arr) && arr.forEach(walk));
    ["children", "items"].forEach((k) => {
      const arr = (node as any)[k]; if (Array.isArray(arr)) arr.forEach(walk);
    });
  };
  walk(root);
  const seen = new Set<string>();
  return out.filter((x) => x.href && !seen.has(x.href!) && seen.add(x.href!));
}

// 旧模板路径 → React 页面路径
function htmlTemplateToReactModulePath(template: string): string | null {
  const m = template.match(/^modules\/(.+?)\/frontend\/templates\/(.+?)\.html$/);
  if (!m) return null;
  return `modules/${m[1]}/frontend/react/pages/${m[2]}.tsx`;
}

// 选择动态 import loader（由 Vite 处理）
function pickModuleLoader(reactRelativePath: string): (() => Promise<{ default: React.ComponentType<any> }>) | null {
  // 通过 vite 的 import.meta.glob 生成的模块表去匹配
  const modulesMap = (import.meta as any).glob("/modules/**/frontend/react/pages/**/*.tsx");
  for (const k in modulesMap) if (k.endsWith(reactRelativePath)) return (modulesMap as any)[k];
  return null;
}

/** 首页默认跳转：优先第一个“有模板的 tab（L3）” */
function guessHomePath(nav: AnyObj): string {
  const tabsDict = nav.tabs || {};
  const bases = Object.keys(tabsDict);
  for (const b of bases) {
    const arr = Array.isArray(tabsDict[b]) ? tabsDict[b] : [];
    const firstWithTpl = arr.find((t: any) => !!t.template) || arr[0];
    if (firstWithTpl?.href) return firstWithTpl.href;
  }
  // 兜底：第一个 L1 → 第一个 L2 → 其第一个 tab，否则 L2
  const menus = (nav.menu || nav.menus || nav.items || []) as any[];
  if (Array.isArray(menus) && menus.length) {
    const l1 = menus.map((m: any) => ({ ...m, href: m.href || m.path || "/" }));
    const firstL1 = l1[0];
    const l2 = (firstL1?.children || firstL1?.items || []) as any[];
    if (Array.isArray(l2) && l2.length) {
      const base = l2[0].href || l2[0].path || firstL1.href || "/";
      const arr = tabsDict[base] || [];
      if (Array.isArray(arr) && arr.length) return arr[0].href || base;
      return base;
    }
    return firstL1.href || "/";
  }
  return "/";
}

/** 根据 nav 构造 routes */
function buildRoutesFromNav(nav: AnyObj): RouteObject[] {
  const children: RouteObject[] = [];

  // 依据 nav.tabs（以及各 L2 的 tabs）推导页面
  const tabs = flattenTabs(nav);
  tabs.forEach((tab) => {
    const href = tab.href || "/";
    const rel = tab.template ? htmlTemplateToReactModulePath(tab.template) : null;
    if (!rel) return;
    const loader = pickModuleLoader(rel);
    if (loader) {
      const Lazy = React.lazy(loader as any);
      children.push({
        path: href,
        element: (
          <React.Suspense fallback={<div className="p-4 text-sm text-slate-600">加载中…</div>}>
            <Lazy />
          </React.Suspense>
        ),
      });
    }
  });

  const home = guessHomePath(nav);
  children.push({ index: true, element: <Navigate to={home} replace /> });
  children.push({ path: "*", element: <NotFound /> });

  return [{ path: "/", element: <ShellLayout />, children }];
}

/** skeleton：立刻挂外壳与占位首页（导航可以先出现） */
function buildSkeletonRouter(): any {
  return createBrowserRouter([
    {
      path: "/",
      element: <ShellLayout />,
      children: [
        { index: true, element: <div className="p-4 text-sm text-slate-600">加载导航中…</div> },
        { path: "*", element: <NotFound /> },
      ],
    },
  ]);
}

export function YamlRouter() {
  const [router, setRouter] = React.useState<any>(() => buildSkeletonRouter());

  React.useEffect(() => {
    (async () => {
      try {
        const nav = await fetchNav();
        const routes = buildRoutesFromNav(nav);
        (window as any).__routes = routes;
        setRouter(createBrowserRouter(routes));
      } catch (e) {
        console.error("[YamlRouter] init failed:", e);
      }
    })();
  }, []);

  if (!router) return <div className="p-4 text-sm text-slate-600">初始化路由…</div>;
  return <RouterProvider router={router} />;
}
