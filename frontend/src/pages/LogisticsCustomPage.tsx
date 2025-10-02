import React from "react"
import { LDialog } from "../components/LDialog"

export function LogisticsCustomPage(){
  const [openNew, setOpenNew] = React.useState(false)
  const [openRename, setOpenRename] = React.useState(false)
  const [openDelete, setOpenDelete] = React.useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">自定义物流</h2>
        <div className="flex gap-2">
          <button className="rounded bg-black text-white px-3 py-1.5 text-sm" onClick={()=>setOpenNew(true)}>新增</button>
          <button className="rounded border px-3 py-1.5 text-sm" onClick={()=>setOpenRename(true)}>重命名</button>
          <button className="rounded border px-3 py-1.5 text-sm" onClick={()=>setOpenDelete(true)}>删除</button>
        </div>
      </div>
      <div className="border rounded-xl p-4">
        <div className="text-sm text-slate-500">物流渠道列表（替换为真实数据）</div>
      </div>

      <LDialog open={openNew} onOpenChange={setOpenNew} title="新增自定义物流" size="sm" footer={
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1.5 text-sm rounded border" onClick={()=>setOpenNew(false)}>取消</button>
          <button className="px-3 py-1.5 text-sm rounded bg-black text-white">保存</button>
        </div>
      }>
        <form className="grid gap-3">
          <div className="grid grid-cols-[120px_1fr] items-center gap-2">
            <div className="text-sm text-slate-600">服务商</div>
            <input className="border rounded px-2 py-1 w-full" placeholder="如：顺丰 / 申通…" />
          </div>
          <div className="grid grid-cols-[120px_1fr] items-center gap-2">
            <div className="text-sm text-slate-600">渠道名</div>
            <input className="border rounded px-2 py-1 w-full" placeholder="多个用逗号分隔…" />
          </div>
        </form>
      </LDialog>

      <LDialog open={openRename} onOpenChange={setOpenRename} title="重命名自定义物流" size="sm">
        <div className="grid gap-2">
          <input className="border rounded px-2 py-1 w-full" placeholder="新名称…" />
          <button className="px-3 py-1.5 text-sm rounded bg-black text-white self-end">保存</button>
        </div>
      </LDialog>

      <LDialog open={openDelete} onOpenChange={setOpenDelete} title="删除确认" size="sm" footer={
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1.5 text-sm rounded border" onClick={()=>setOpenDelete(false)}>取消</button>
          <button className="px-3 py-1.5 text-sm rounded bg-black text-white">删除</button>
        </div>
      }>
        <div className="text-sm text-slate-600">确定删除该自定义物流？该操作不可恢复。</div>
      </LDialog>
    </div>
  )
}
