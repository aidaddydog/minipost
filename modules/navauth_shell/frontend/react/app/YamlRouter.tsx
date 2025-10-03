import React from "react";
import {
  createBrowserRouter,
  RouterProvider,
  RouteObject,
  Navigate,
} from "react-router-dom";
import { ShellLayout } from "./ShellLayout"; // ← 修正为具名导入

function NotFound() {
  return <div className="p-6 text-sm text-slate-600">页面不存在或尚未迁移。</div>;
}

type AnyObj = Record<string, any>;
type TabLike = { href?: string; template?: string; title?: string };

function buildSkeletonRouter(element: React.ReactNode) {
  const routes: RouteObject[] = [
    { path: "/", element: <ShellLayout /> },
    { path: "*", element },
  ];
  return createBrowserRouter(routes);
}

function buildRoutesFromNav(nav: AnyObj) {
  const routes: RouteObject[] = [
    {
      path: "/",
      element: <ShellLayout />,
      children: [],
    },
    { path: "/login", element: <Navigate to="/" replace /> },
    { path: "*", element: <NotFound /> },
  ];
  // 这里保留占位，后续若需要可把 nav.menu / nav.tabs 展开到 children
  return routes;
}

export function YamlRouter() {
  const [router, setRouter] = React.useState<any>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/nav", { headers: { accept: "application/json" } });
        const nav = r.ok ? await r.json() : { menu: {}, tabs: {} };
        const routes = buildRoutesFromNav(nav);
        (window as any).__routes = routes;
        setRouter(createBrowserRouter(routes));
      } catch (e: any) {
        console.error("[YamlRouter] init failed:", e);
        setErr(e?.message || String(e));
        setRouter(buildSkeletonRouter(<div className="p-4 text-sm text-red-600">加载导航失败：{String(e)}</div>));
      }
    })();
  }, []);

  if (!router) return <div className="p-4 text-sm text-slate-600">初始化路由…</div>;
  return <RouterProvider router={router} />;
}
