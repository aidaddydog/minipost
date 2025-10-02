import React from "react"
import { LDialog } from "../components/LDialog"

type BranchResp = { branches: string[] }
type CheckResp  = { update_available: boolean; version: string | null }

export function SystemUpgradePage(){
  const [branches, setBranches] = React.useState<string[]>([])
  const [branch, setBranch] = React.useState("")
  const [check, setCheck] = React.useState<CheckResp | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [openSettings, setOpenSettings] = React.useState(false)
  const [openLog, setOpenLog] = React.useState(false)

  React.useEffect(()=>{
    fetch("/api/settings/system_settings/system_upgrade/branches").then(r=>r.json()).then(d=>setBranches(d.branches || [])).catch(()=>{})
  }, [])

  async function onCheck(){
    setLoading(true)
    try{
      const res = await fetch("/api/settings/system_settings/system_upgrade/check", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ branch })})
      const data = await res.json(); setCheck(data)
    }catch(e){ console.warn(e) } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="text-sm">
            <div className="text-slate-500">分支</div>
            <select className="border rounded px-2 py-1" value={branch} onChange={(e)=>setBranch(e.target.value)}>
              <option value="">请选择</option>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <button className="rounded bg-black text-white px-3 py-1.5 text-sm" onClick={()=>setOpenSettings(true)}>更新设置</button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-700 text-sm">{check ? (check.update_available ? `检测到更新：${check.version}` : "已是最新") : ""}</span>
          <button className="rounded bg-black text-white px-3 py-1.5 text-sm" onClick={onCheck} disabled={loading}>检查更新</button>
          <button className="rounded bg-black text-white px-3 py-1.5 text-sm" onClick={()=>setOpenLog(true)}>查看日志</button>
        </div>
      </div>

      <div className="border rounded-xl p-4">
        <div className="text-sm text-slate-500">这里是系统更新列表…（可替换为真实数据表格）</div>
      </div>

      <LDialog open={openSettings} onOpenChange={setOpenSettings} title="更新设置">
        <div className="space-y-3">
          <div className="text-sm">设置项示例 A</div>
          <input className="border rounded px-2 py-1 w-full" placeholder="在此输入…" />
        </div>
      </LDialog>

      <LDialog open={openLog} onOpenChange={setOpenLog} title="更新日志">
        <div className="text-sm">这里显示更新日志内容（从 /api/settings/system_settings/system_upgrade/history/{id}/log 获取）。</div>
      </LDialog>
    </div>
  )
}
