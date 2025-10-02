import React from "react"
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom"

type Item = { title: string; path: string; children?: Item[] }

async function fetchNav(): Promise<Item[]>{
  try{
    const res = await fetch("/api/nav")
    if(!res.ok) throw new Error(await res.text())
    const data = await res.json()
    return (data.items || []) as Item[]
  }catch(e){ console.warn(e); return [] }
}

export function ShellLayout(){
  const [items, setItems] = React.useState<Item[]>([])
  const loc = useLocation()
  const nav = useNavigate()

  React.useEffect(()=>{ fetchNav().then(setItems) }, [])

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b">
        <div className="mx-auto max-w-screen-xl h-14 px-6 flex items-center justify-between">
          <div className="font-semibold">minipost</div>
          <nav className="flex items-center gap-2">
            {items.map(it => (
              <Link className={navCls(loc.pathname.startsWith(it.path))} key={it.path} to={it.path}>{it.title}</Link>
            ))}
          </nav>
          <div className="text-sm text-slate-500">
            <button className="px-2 py-1 rounded hover:bg-slate-100" onClick={()=>nav("/login")}>登录</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-screen-xl px-6 py-4">
        {/* 二级导航（L2） */}
        <div className="mb-3 flex gap-2 flex-wrap">
          {(items.find(it=>loc.pathname.startsWith(it.path))?.children || []).map(l2 => (
            <Link className={"px-2 py-1 rounded " + (loc.pathname.startsWith(l2.path) ? "bg-slate-900 text-white" : "hover:bg-slate-100")} key={l2.path} to={l2.path}>{l2.title}</Link>
          ))}
        </div>

        {/* 内容 */}
        <Outlet />
      </main>
    </div>
  )
}

function navCls(active: boolean){ return "px-3 py-1.5 rounded text-sm " + (active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-900/80 hover:text-white") }
