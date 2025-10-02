import React from "react"

export function LoginPage(){
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function submit(e: React.FormEvent){
    e.preventDefault(); setLoading(true); setError(null)
    try{
      const body = new URLSearchParams({ username, password });
      const res = await fetch("/api/login", { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body }) })
      if(!res.ok) throw new Error(await res.text())
      window.location.href = "/"
    }catch(e:any){ setError(e.message || "登录失败") } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen grid place-items-center">
      <form onSubmit={submit} className="w-[min(92vw,400px)] border rounded-xl p-6 space-y-4">
        <div className="text-lg font-semibold">登录</div>
        <input className="border rounded px-2 py-2 w-full" placeholder="用户名" value={username} onChange={e=>setUsername(e.target.value)} />
        <input type="password" className="border rounded px-2 py-2 w-full" placeholder="密码" value={password} onChange={e=>setPassword(e.target.value)} />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button disabled={loading} className="w-full rounded bg-black text-white px-3 py-2">{loading ? "登录中…" : "登录"}</button>
      </form>
    </div>
  )
}
