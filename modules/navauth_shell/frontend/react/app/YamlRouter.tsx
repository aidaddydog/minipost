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
  // 允许使用缓存，避免重复请求
  const cached = (window as any).__navjson;
  if (cached) return cached;

  const res = await fetch("/api/nav", {
    headers: { Accept: "application/json" },
    credentials: "include", // ← 关键：携带登录 Cookie
  });

  if (res.status === 401) {
    // 未登录或会话失效
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

// 旧模板 → 模块内 React 页面（与旧 YAML 完全兼容）
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

/** 计算“首页默认跳转路径”：
 *  优先：第一个 L1 的第一个 L2；备选：第一个 L1；最后：第一个可渲染 tab/href
 */
function guessHomePath(nav: AnyObj): string {
  const menus = (nav.menus || nav.menu || nav.items || []) as any[];
  if (Array.isArray(menus) && menus.length) {
    const l1 = menus.map((m: any) => ({ ...m, href: m.href || m.path || "/" }));
    const firstL1 = l1[0];
    const l2 = (firstL1?.children || firstL1?.items || []) as any[];
    if (Array.isArray(l2) && l2.length) {
      const firstL2 = { ...l2[0], href: l2[0].href || l2[0].path || firstL1.href || "/" };
      return firstL2.href;
    }
    return firstL1.href || "/";
  }
  // 再退回到 tabs 字典
  const tabs = nav.tabs || {};
  const keys = Object.keys(tabs || {});
  if (keys.length && Array.isArray(tabs[keys[0]]) && tabs[keys[0]].length) {
    return tabs[keys[0]][0].href || tabs[keys[0]][0].path || "/";
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

  // 根路径的默认跳转（确保登录后不会空白）
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
    // 其他路径一律重定向到 /login（避免空白）
    { path: "*", element: <Navigate to="/login" replace /> },
  ];
  return createBrowserRouter(routes);
}

export function YamlRouter() {
  const [router, setRouter] = React.useState<any>(null);

  React.useEffect(() => {
    const path = window.location.pathname;
    // 在 /login 用轻量路由，避免首屏加载 /api/nav 造成卡顿
    if (path === "/login") {
      setRouter(buildLoginOnlyRouter());
      return;
    }
    (async () => {
      try {
        const nav = await fetchNav();
        const routes = buildRoutesFromNav(nav);
        (window as any).__routes = routes; // 调试辅助
        setRouter(createBrowserRouter(routes));
      } catch (e) {
        // 如果拉取失败（例如 401 已跳转），这里保持空即可
        console.error("[YamlRouter] init failed:", e);
      }
    })();
  }, []);

  if (!router) return <div className="p-4 text-sm text-slate-600">初始化路由…</div>;
  return <RouterProvider router={router} />;
}
