import React from "react";
import {
  createBrowserRouter,
  RouterProvider,
  RouteObject,
  Navigate,
} from "react-router-dom";
import { ShellLayout } from "./ShellLayout";

// 轻量 404
function NotFound() {
  return <div className="p-6 text-sm text-slate-600">页面不存在或尚未迁移。</div>;
}

type AnyObj = Record<string, any>;
type TabLike = { href?: string; template?: string; title?: string };

/** 拉取 /api/nav（带 Cookie）。401 时直接回登录页 */
async function fetchNav(): Promise<AnyObj> {
  const cached = (window as any).__navjson;
  if (cached) return cached;

  const res = await fetch("/api/nav", {
    headers: { Accept: "application/json" },
    credentials: "include", // 关键：携带登录 Cookie
  });

  if (res.status === 401) {
    window.location.assign("/login");
    throw new Error("Unauthorized");
  }
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
      const arr = node[k];
      if (Array.isArray(arr)) arr.forEach(walk);
    });
  };
  walk(root);
  const seen = new Set<string>();
  return out.filter((x) => x.href && !seen.has(x.href!) && seen.add(x.href!));
}

// 旧模板 → 模块 React 页面
//   modules/<domain>/<feature>/frontend/templates/<page>.html
// → modules/<domain>/<feature>/frontend/react/pages/<page>.tsx
function htmlTemplateToReactModulePath(template: string): string | null {
  const m = template.match(/^modules\/(.+?)\/frontend\/templates\/(.+?)\.html$/);
  if (!m) return null;
  return `modules/${m[1]}/frontend/react/pages/${m[2]}.tsx`;
}

// 合法 glob（必须以 ./ 或 / 开头）
const gRel = import.meta.glob("../../../../modules/**/frontend/react/pages/**/*.{tsx,jsx}");
const gAbs = import.meta.glob("/modules/**/frontend/react/pages/**/*.{tsx,jsx}");
const modulesMap: Record<string, any> = { ...gRel, ...gAbs };

// 宽容匹配（不同 glob 生成的 key 前缀不同）
function pickModuleLoader(reactRelativePath: string): any | null {
  for (const k in modulesMap) if (k.endsWith(reactRelativePath)) return modulesMap[k];
  return null;
}

/** 计算“首页默认跳转路径”：优先选择“第一个有模板的 tab（L3）” */
function guessHomePath(nav: AnyObj): string {
  // 先找 tabs 里第一个条目（更可靠，因为我们为 tab 挂了真正的 React 页面）
  const tabsDict = nav.tabs || {};
  const sortedBases = Object.keys(tabsDict).sort();
  for (const base of sortedBases) {
    const arr = Array.isArray(tabsDict[base]) ? tabsDict[base] : [];
    if (!arr.length) continue;
    const firstWithTpl = arr.find((t: any) => !!t.template) || arr[0];
    if (firstWithTpl?.href) return firstWithTpl.href;
  }

  // 兜底：从 menu 抽第一个 L1 的第一个 L2 的第一个 tab
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

function buildRoutesFromNav(nav: AnyObj): RouteObject[] {
  const children: RouteObject[] = [];
  const tabs = flattenTabs(nav);

  tabs.forEach((tab) => {
    const href = tab.href!;
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

  // 根路径的默认跳转（→ 第一个可渲染的 L3）
  const home = guessHomePath(nav);
  children.push({ index: true, element: <Navigate to={home} replace /> });

  // 兜底 404
  children.push({ path: "*", element: <NotFound /> });

  return [
    {
      path: "/",
      element: <ShellLayout />,
      children,
    },
  ];
}

// 仅登录页的轻量 Router（不拉 /api/nav，不装外壳）
function buildLoginOnlyRouter(): any {
  const loginRel = "modules/auth_login/frontend/react/pages/auth_login.tsx";
  const loader = pickModuleLoader(loginRel);
  const Login = loader ? React.lazy(loader as any) : () => <div>Login</div>;
  const routes: RouteObject[] = [
    { path: "/login", element: <React.Suspense fallback={<div />}><Login /></React.Suspense> },
    { path: "*", element: <Navigate to="/login" replace /> },
  ];
  return createBrowserRouter(routes);
}

export function YamlRouter() {
  const [router, setRouter] = React.useState<any>(null);

  React.useEffect(() => {
    const path = window.location.pathname;
    if (path === "/login") {
      setRouter(buildLoginOnlyRouter());
      return;
    }
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
