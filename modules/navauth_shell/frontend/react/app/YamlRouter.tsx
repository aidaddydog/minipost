import React from "react";
import {
  createBrowserRouter,
  RouterProvider,
  RouteObject,
  Navigate,
} from "react-router-dom";
import ShellLayout from "./ShellLayout";

/** 小提示：此路由器做三件事
 * 1) 立刻挂“骨架路由”（含 /login + 外壳），让页面快速可交互
 * 2) 异步拉 /api/nav，按模块 tabs 动态生成业务页面
 * 3) 兜底把没注册的路由转去 NotFound
 */

function NotFound() {
  return <div className="p-6 text-sm text-slate-600">页面不存在或尚未迁移。</div>;
}

type AnyObj = Record<string, any>;
type TabLike = { href?: string; template?: string; title?: string };

/** ---------- 动态模块加载（由 Vite 负责打包） ---------- */
const modulesMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> =
  import.meta.glob("/modules/**/frontend/react/pages/**/*.tsx");

/** 旧模板路径 → React 页面路径 */
function htmlTemplateToReactModulePath(template: string): string | null {
  const m = template.match(/^modules\/(.+?)\/frontend\/templates\/(.+?)\.html$/);
  if (!m) return null;
  return `modules/${m[1]}/frontend/react/pages/${m[2]}.tsx`;
}

/** 根据相对路径在 modulesMap 里拿到 loader */
function pickModuleLoader(reactRelativePath: string):
  (() => Promise<{ default: React.ComponentType<any> }>) | null {
  for (const k in modulesMap) {
    if (k.endsWith(reactRelativePath)) return modulesMap[k];
  }
  return null;
}

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

/** ---------- 构造完整路由 ---------- */
function buildRoutesFromNav(nav: AnyObj): RouteObject[] {
  const topLevel: RouteObject[] = [];

  // 1) 登录页：始终独立于外壳
  const loginRel = "modules/auth_login/frontend/react/pages/auth_login.tsx";
  const loginLoader = pickModuleLoader(loginRel);
  if (loginLoader) {
    const Login = React.lazy(loginLoader as any);
    topLevel.push({
      path: "/login",
      element: (
        <React.Suspense fallback={<div className="p-4 text-sm text-slate-600">加载登录页…</div>}>
          <Login />
        </React.Suspense>
      ),
    });
  }

  // 2) 外壳 + 业务模块（由 nav.tabs 推导）
  const children: RouteObject[] = [];
  const tabs = flattenTabs(nav);
  tabs.forEach((tab) => {
    const href = tab.href || "/";
    if (!tab.template) return; // 没模板暂不生成页面
    const rel = htmlTemplateToReactModulePath(tab.template);
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

  topLevel.push({ path: "/", element: <ShellLayout />, children });
  return topLevel;
}

/** skeleton：立刻挂载“外壳 + 登录”占位，等 nav 到来再热替换 */
function buildSkeletonRouter(): any {
  const routes: RouteObject[] = [];

  // 登录占位（避免跳 /login 时露白）
  const loginRel = "modules/auth_login/frontend/react/pages/auth_login.tsx";
  const loginLoader = pickModuleLoader(loginRel);
  if (loginLoader) {
    const Login = React.lazy(loginLoader as any);
    routes.push({
      path: "/login",
      element: (
        <React.Suspense fallback={<div className="p-4 text-sm text-slate-600">加载登录页…</div>}>
          <Login />
        </React.Suspense>
      ),
    });
  }

  // 外壳 + 首页占位
  routes.push({
    path: "/",
    element: <ShellLayout />,
    children: [{ index: true, element: <div className="p-4 text-sm text-slate-600">加载导航中…</div> }],
  });

  routes.push({ path: "*", element: <NotFound /> });
  return createBrowserRouter(routes);
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
