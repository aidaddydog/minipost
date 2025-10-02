import React from "react"
import { createBrowserRouter, RouterProvider, RouteObject } from "react-router-dom"
import { ShellLayout } from "./ShellLayout"
import { NotFound } from "./pages/NotFound"

type AnyObj = Record<string, any>
type Tab = { title?: string; href?: string; template?: string }
type NavItem = { title?: string; path?: string; href?: string; template?: string; tabs?: Tab[]; items?: NavItem[]; children?: NavItem[] }

// 收集所有模块中的页面组件
const modulesMap = import.meta.glob("/modules/**/frontend/react/pages/**/*.{tsx,jsx}")

function htmlTemplateToReactModulePath(template: string): string | null {
  // modules/<domain>/<feature>/frontend/templates/<page>.html -> /modules/<domain>/<feature>/frontend/react/pages/<page>.tsx
  const m = template.match(/^modules\/(.+?)\/frontend\/templates\/(.+?)\.html$/)
  if(!m) return null
  return `/modules/${m[1]}/frontend/react/pages/${m[2]}.tsx`
}

function flattenTabs(root: AnyObj): { href: string; template?: string; title?: string }[] {
  const out: { href: string; template?: string; title?: string }[] = []
  const dfs = (node: AnyObj) => {
    if(!node || typeof node!=="object") return
    const href = node.href || node.path
    if(href && typeof href==="string") out.push({ href, template: node.template, title: node.title })
    const tabs = node.tabs
    if(Array.isArray(tabs)) tabs.forEach(t => { if(t?.href) out.push({ href: t.href, template: t.template, title: t.title }) })
    for(const k of ["children", "items"]){
      const arr = node[k]
      if(Array.isArray(arr)) arr.forEach(dfs)
    }
    if(node.tabs && typeof node.tabs==="object" && !Array.isArray(node.tabs)){
      Object.values(node.tabs).forEach((arr: any)=>{ if(Array.isArray(arr)) arr.forEach(dfs) })
    }
  }
  dfs(root)
  const seen = new Set<string>()
  return out.filter(x=>{
    if(!x.href) return false
    if(seen.has(x.href)) return false
    seen.add(x.href)
    return true
  })
}

async function fetchNav(): Promise<AnyObj>{
  const res = await fetch("/api/nav", { headers: { "Accept": "application/json" } })
  if(!res.ok) throw new Error(await res.text())
  return res.json()
}

function buildRoutesFromNav(nav: AnyObj): RouteObject[]{
  const children: RouteObject[] = []
  const tabs = flattenTabs(nav)
  tabs.forEach(tab => {
    if(!tab.href) return
    const reactPath = tab.template ? htmlTemplateToReactModulePath(tab.template) : null
    if(reactPath && modulesMap[reactPath]){
      const Lazy = React.lazy(modulesMap[reactPath] as any)
      children.push({
        path: tab.href,
        element: <React.Suspense fallback={<div className="p-4 text-sm text-slate-600">加载中…</div>}><Lazy/></React.Suspense>
      })
    }
  })
  children.push({ path: "*", element: <NotFound /> })
  const routes: RouteObject[] = [
    { path: "/", element: <ShellLayout />, children: [
      { index: true, element: <div className="p-4 text-sm text-slate-600">欢迎使用 minipost（React 外壳）。</div> },
      ...children
    ]}
  ]
  return routes
}

export function YamlRouter(){
  const [router, setRouter] = React.useState<any>(null)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(()=>{
    (async()=>{
      try{
        const nav = await fetchNav()
        const routes = buildRoutesFromNav(nav)
        setRouter(createBrowserRouter(routes))
      }catch(e:any){
        setErr(e?.message || "加载导航失败")
      }
    })()
  }, [])

  if(err) return <div className="p-4 text-sm text-red-600">路由初始化失败：{err}</div>
  if(!router) return <div className="p-4 text-sm text-slate-600">初始化路由…</div>
  return <RouterProvider router={router} />
}
