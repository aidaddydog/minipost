import React, { useEffect, useMemo, useRef, useState } from "react";
import TopNav, { L1Item } from "./components/TopNav";
import SubNav from "./components/SubNav";
import PageTabs from "./components/PageTabs";

type L2 = { text: string; href: string; owner?: string; order?: number };
type TabsDict = Record<string, { key: string; text: string; href: string }[]>;

type NavResp = {
  menu?: { l2?: L2[] } | L2[];
  tabs?: TabsDict;
  // legacy or alternative keys ignored
  [k: string]: any;
};

type Model = {
  l1: L1Item[];
  l2ByL1: Record<string, L2[]>;
  tabsDict: TabsDict;
};

const SCHEMA_VERSION = 11;
const STORAGE_KEY = "NAV_STATE_V11";

function ownerOf(href: string){
  if(!href || href[0] !== "/") return "/";
  const seg = href.split("/").filter(Boolean);
  return seg.length ? ("/" + seg[0]) : "/";
}

function normalizeMenu(m: NavResp["menu"]): L2[] {
  if(!m) return [];
  // accept either {l2:[]} or [] directly
  const arr = Array.isArray(m) ? m : (Array.isArray((m as any).l2) ? (m as any).l2 : []);
  return arr.map((x: any) => ({
    text: String(x.text ?? x.label ?? ""),
    href: String(x.href ?? ""),
    owner: x.owner ? String(x.owner) : ownerOf(String(x.href ?? "")),
    order: Number.isFinite(+x.order) ? +x.order : 0,
  })).filter(x => x.text && x.href);
}

function deriveModel(resp: NavResp): Model {
  const l2 = normalizeMenu(resp.menu);
  const l1Order: string[] = [];
  const l2ByL1: Record<string, L2[]> = {};
  for(const it of l2){
    const o = it.owner!;
    if(!l2ByL1[o]){ l2ByL1[o] = []; l1Order.push(o); }
    l2ByL1[o].push(it);
  }
  for(const k of Object.keys(l2ByL1)){ l2ByL1[k].sort((a,b)=> (a.order??0)-(b.order??0) || a.text.localeCompare(b.text)); }
  const l1: L1Item[] = l1Order.sort((a,b)=> a.localeCompare(b)).map(p => ({
    path: p,
    text: p==="/orders"?"订单": p==="/products"?"商品": p==="/logistics"?"物流": p==="/settings"?"设置": p.replace(/^\//,""),
  }));
  const tabsDict: TabsDict = resp.tabs || {};
  return { l1, l2ByL1, tabsDict };
}

export default function ShellLayout(){
  const [model, setModel] = useState<Model>({ l1: [], l2ByL1: {}, tabsDict: {} });
  const [activeL1, setActiveL1] = useState<string>("/orders");
  const [activeL2, setActiveL2] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("");

  // read from localStorage
  useEffect(()=>{
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        const st = JSON.parse(raw);
        if(st && st.v===SCHEMA_VERSION){
          if(typeof st.lockedPath==="string") setActiveL1(st.lockedPath);
          if(typeof st.lockedSubHref==="string") setActiveL2(st.lockedSubHref);
          if(typeof st.lockedTabHref==="string") setActiveTab(st.lockedTabHref);
        }
      }
    }catch{}
  }, []);

  // fetch nav
  useEffect(()=>{
    (async ()=>{
      try{
        const r = await fetch("/api/nav", { headers: { "accept": "application/json" } });
        if(!r.ok) throw new Error("nav http "+r.status);
        const data = await r.json() as NavResp;
        const m = deriveModel(data);
        setModel(m);
        // fallback choose first L2 if empty
        const fallbackL2 = (!activeL2 && m.l2ByL1[activeL1] && m.l2ByL1[activeL1][0]?.href) ? m.l2ByL1[activeL1][0].href : activeL2;
        setActiveL2(fallbackL2);
        // fallback tab
        const tabs = m.tabsDict[fallbackL2||""] || [];
        if(tabs.length && !activeTab){ setActiveTab(tabs[0].href); }
      }catch(e){
        console.error("nav load failed", e);
      }
    })();
  }, []);

  // persist
  useEffect(()=>{
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: SCHEMA_VERSION, lockedPath: activeL1, lockedSubHref: activeL2, lockedTabHref: activeTab, ts: Date.now() })); }catch{}
  }, [activeL1, activeL2, activeTab]);

  const l2List = model.l2ByL1[activeL1] || [];
  const tabs   = model.tabsDict[activeL2 || ""] || [];

  return (
    <>
      <div className="shell">
        <div className="header">
          <a className="logo" href="/admin" aria-label="仪表盘"></a>
          <div className="header-gap-left" aria-hidden="true"></div>

          <TopNav
            items={model.l1}
            activePath={activeL1}
            onHover={(p)=>{/* just visual; pill handled in TopNav */}}
            onLeave={()=>{/* noop */}}
            onClick={(p)=>{
              setActiveL1(p);
              const nextL2 = (model.l2ByL1[p] && model.l2ByL1[p][0]?.href) || "";
              setActiveL2(nextL2);
              const nextTabs = model.tabsDict[nextL2] || [];
              setActiveTab(nextTabs[0]?.href || "");
            }}
          />

          <div className="header-gap-right" aria-hidden="true"></div>
          <div className="avatar" aria-label="头像"></div>
        </div>
      </div>

      <SubNav
        items={l2List.map(s => ({ text: s.text, href: s.href, owner: s.owner || ownerOf(s.href) }))}
        activeHref={activeL2}
        onClick={(href)=>{
          setActiveL2(href);
          const t = model.tabsDict[href] || [];
          setActiveTab(t[0]?.href || "");
        }}
      />

      <PageTabs
        tabs={tabs.map(t => ({ ...t, subHref: activeL2 }))}
        activeHref={activeTab}
        onClick={(href)=> setActiveTab(href)}
      />
    </>
  );
}
