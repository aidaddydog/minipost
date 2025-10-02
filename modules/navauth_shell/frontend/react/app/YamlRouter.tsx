import React from "react";
import {
  createBrowserRouter,
  RouterProvider,
  RouteObject,
} from "react-router-dom";
import { ShellLayout } from "./ShellLayout"; // 同目录下外壳
// 轻量 404
function NotFound() {
  return <div className="p-6 text-sm text-slate-600">页面不存在或尚未迁移。</div>;
}

/** 运行时自动装配：把 YAML 的 template → 前端 React 文件路径 */
type AnyObj = Record<string, any>;
type TabLike = { href?: string; template?: string; title?: string };

async function fetchNav(): Promise<AnyObj> {
  const res = await fetch("/api/nav", { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function flattenTabs(root: AnyObj): TabLike[] {
  const out: TabLike[] = [];
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    const href = node.href || node.path;
    if (href && typeof href === "string") {
      out.push({ href, template: node.template, title: node.title });
    }
    // 支持 tabs:[] / tabs:{base:[...]}
    if (Array.isArray(node.tabs)) node.tabs.forEach(walk);
    else if (node.tabs && typeof node.tabs === "object")
      Object.values(node.tabs).forEach((arr: any) => Array.isArray(arr) && arr.forEach(walk));
    // 支持 children/items
    ["children", "items"].forEach((k) => {
      const arr = node[k];
      if (Array.isArray(arr)) arr.forEach(walk);
    });
  };
  walk(root);
  // 去重
  const seen = new Set<string>();
  return out.filter((x) => x.href && !seen.has(x.href!) && seen.add(x.href!));
}

// === 关键修正：把“旧模板路径”映射到“模块内 React 页面路径” ===
function htmlTemplateToReactModulePath(template: string): string | null {
  // 旧模板：modules/<domain>/<feature>/frontend/templates/<page>.html
  const m = template.match(/^modules\/(.+?)\/frontend\/templates\/(.+?)\.html$/);
  if (!m) return null;
  // 新 React：modules/<domain>/<feature>/frontend/react/pages/<page>.tsx
  return `modules/${m[1]}/frontend/react/pages/${m[2]}.tsx`;
}

// === 提高鲁棒性：多种 glob 写法（任一匹配即可；不匹配会返回空对象，不会报错） ===
const g1 = import.meta.glob(
  "../../../../modules/**/frontend/react/pages/**/*.{tsx,jsx}"
);
const g2 = import.meta.glob(
  "modules/**/frontend/react/pages/**/*.{tsx,jsx}"
);
const g3 = import.meta.glob(
  "/modules/**/frontend/react/pages/**/*.{tsx,jsx}"
);
// 合并所有匹配
const modulesMap: Record<string, any> = { ...g1, ...g2, ...g3 };

function buildRoutesFromNav(nav: AnyObj): RouteObject[] {
  const children: RouteObject[] = [];
  const tabs = flattenTabs(nav);

  const foundPaths = new Set<string>();

  tabs.forEach((tab) => {
    const href = tab.href!;
    const reactPath = tab.template ? htmlTemplateToReactModulePath(tab.template) : null;
    if (reactPath && modulesMap[reactPath]) {
      const Lazy = React.lazy(modulesMap[reactPath] as any);
      children.push({
        path: href,
        element: (
          <React.Suspense fallback={<div className="p-4 text-sm text-slate-600">加载中…</div>}>
            <Lazy />
          </React.Suspense>
        ),
      });
      foundPaths.add(href);
    }
  });

  // 如果 YAML 没有 /login 或映射失败，强制挂载登录页（兜底）
  if (!foundPaths.has("/login")) {
    const loginKey =
      "modules/auth_login/frontend/react/pages/auth_login.tsx";
    if (modulesMap[loginKey]) {
      const Login = React.lazy(modulesMap[loginKey] as any);
      children.push({
        path: "/login",
        element: (
          <React.Suspense fallback={<div className="p-4 text-sm text-slate-600">加载中…</div>}>
            <Login />
          </React.Suspense>
        ),
      });
    }
  }

  // 兜底 404
  children.push({ path: "*", element: <NotFound /> });

  return [
    {
      path: "/",
      element: <ShellLayout />,
      children: [
        // 可选首页占位
        { index: true, element: <div className="p-4 text-sm text-slate-600">欢迎使用 minipost（React 外壳）。</div> },
        ...children,
      ],
    },
  ];
}

export function YamlRouter() {
  const [router, setRouter] = React.useState<any>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const nav = await fetchNav();
        const routes = buildRoutesFromNav(nav);
        const r = createBrowserRouter(routes);
        // 调试用：在控制台查看动态路由
        (window as any).__routes = routes;
        setRouter(r);
      } catch (e: any) {
        setErr(e?.message || "加载导航失败");
      }
    })();
  }, []);

  if (err) return <div className="p-4 text-sm text-red-600">路由初始化失败：{err}</div>;
  if (!router) return <div className="p-4 text-sm text-slate-600">初始化路由…</div>;
  return <RouterProvider router={router} />;
}
