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

/** 拉取并缓存导航 JSON（只面向新 Schema：menu 对象 + tabs 对象） */
async function fetchNav(): Promise<AnyObj> {
  const cached = (window as any).__navjson;
  if (cached) return cached;
  const res = await fetch("/api/nav", { headers: { Accept: "application/json" }, credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  if (!json || typeof json !== "object" || !json.menu || !json.tabs) {
    throw new Error("Invalid /api/nav schema: expect {menu, tabs}");
  }
  (window as any).__navjson = json;
  return json;
}

function flattenTabsFromNewSchema(nav: AnyObj): TabLike[] {
  const out: TabLike[] = [];
  const tabs = (nav && nav.tabs) || {};
  if (tabs && typeof tabs === "object") {
    Object.keys(tabs).forEach((base) => {
      const arr = tabs[base];
      if (Array.isArray(arr)) {
        arr.forEach((t) => out.push({ href: t.href || t.path, template: t.template, title: t.title }));
      }
    });
  }
  const seen = new Set<string>();
  return out.filter((x) => x.href && !seen.has(x.href!) && seen.add(x.href!));
}

/** 首页默认跳转：优先 tabs 的第一个“有模板的 tab”；其次 menu 的第一个 L2 */
function guessHomePath(nav: AnyObj): string {
  const tabs = nav.tabs || {};
  for (const base of Object.keys(tabs)) {
    const arr = Array.isArray(tabs[base]) ? tabs[base] : [];
    const firstWithTpl = arr.find((t: any) => !!t.template) || arr[0];
    if (firstWithTpl?.href) return firstWithTpl.href;
  }
  // 兜底：menu 的第一个 L1 → 第一个 L2
  const menuObj = nav.menu || {};
  const l1Titles = Object.keys(menuObj);
  if (l1Titles.length) {
    const l2List = menuObj[l1Titles[0]] || [];
    const base = (l2List[0] && (l2List[0].href || l2List[0].path)) || "/";
    return base || "/";
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
  const tabs = flattenTabsFromNewSchema(nav);
  tabs.forEach((tab) => {
    const href = tab.href || "/";
    if (!tab.template) return;
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
