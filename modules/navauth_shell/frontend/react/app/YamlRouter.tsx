import React from "react";
import {
  createBrowserRouter,
  RouterProvider,
  RouteObject,
} from "react-router-dom";
import { ShellLayout } from "./ShellLayout";

// 轻量 404
function NotFound() {
  return <div className="p-6 text-sm text-slate-600">页面不存在或尚未迁移。</div>;
}

/** 运行时自动装配：把 YAML 的 template → 模块内 React 文件路径 */
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

// === 关键映射：旧模板 → 模块内 React 页面（与旧 YAML 完全兼容） ===
//   modules/<domain>/<feature>/frontend/templates/<page>.html
// → modules/<domain>/<feature>/frontend/react/pages/<page>.tsx
function htmlTemplateToReactModulePath(template: string): string | null {
  const m = template.match(/^modules\/(.+?)\/frontend\/templates\/(.+?)\.html$/);
  if (!m) return null;
  return `modules/${m[1]}/frontend/react/pages/${m[2]}.tsx`;
}

// === 合法的 glob 写法（必须以 ./ 或 / 开头） ===
// 相对当前位置（本文件位于 modules/navauth_shell/frontend/react/app/）
const gRel = import.meta.glob(
  "../../../../modules/**/frontend/react/pages/**/*.{tsx,jsx}"
);
// 从项目根开始（Vite 会把以 / 开头解析为项目根）
const gAbs = import.meta.glob(
  "/modules/**/frontend/react/pages/**/*.{tsx,jsx}"
);

// 合并两个来源
const modulesMap: Record<string, any> = { ...gRel, ...gAbs };

/** 宽容匹配：不同 glob 生成的 key 前缀不同，这里用 endsWith 对齐到规范相对路径 */
function pickModuleLoader(reactRelativePath: string): any | null {
  for (const k in modulesMap) {
    if (k.endsWith(reactRelativePath)) return modulesMap[k];
  }
  return null;
}

function buildRoutesFromNav(nav: AnyObj): RouteObject[] {
  const children: RouteObject[] = [];
  const tabs = flattenTabs(nav);
  const foundPaths = new Set<string>();

  tabs.forEach((tab) => {
    const href = tab.href!;
    const reactRel = tab.template ? htmlTemplateToReactModulePath(tab.template) : null;
    if (!reactRel) return;
    const loader = pickModuleLoader(reactRel);
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
      foundPaths.add(href);
    }
  });

  // 若 YAML 未挂 /login 或映射失败，强制兜底挂载登录页
  if (!foundPaths.has("/login")) {
    const loginRel = "modules/auth_login/frontend/react/pages/auth_login.tsx";
    const loginLoader = pickModuleLoader(loginRel);
    if (loginLoader) {
      const Login = React.lazy(loginLoader as any);
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
        (window as any).__routes = routes; // 调试辅助
        setRouter(createBrowserRouter(routes));
      } catch (e: any) {
        setErr(e?.message || "加载导航失败");
      }
    })();
  }, []);

  if (err) return <div className="p-4 text-sm text-red-600">路由初始化失败：{err}</div>;
  if (!router) return <div className="p-4 text-sm text-slate-600">初始化路由…</div>;
  return <RouterProvider router={router} />;
}
