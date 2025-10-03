import React, { useEffect, useRef } from "react";

export interface Tab { key: string; text: string; href: string; subHref: string; }
export interface PageTabsProps {
  tabs: Tab[];
  activeHref: string;
  onClick?: (href: string)=>void;
}

function ensureInk(parent: HTMLElement){
  let ink = parent.querySelector<HTMLSpanElement>("#tabInk");
  if(!ink){
    ink = document.createElement("span");
    ink.id = "tabInk";
    ink.className = "tab-ink";
    parent.appendChild(ink);
  }
  return ink;
}

export default function PageTabs({ tabs, activeHref, onClick }: PageTabsProps){
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const el = tabsRef.current;
    if(!el) return;
    const active = el.querySelector<HTMLAnchorElement>(`a.tab[data-href='${activeHref}']`);
    const ink = ensureInk(el);
    if(!active){ ink.style.width="0px"; return; }
    const txt = active.querySelector(".tab__text") || active;
    const rect = (txt as HTMLElement).getBoundingClientRect();
    const tabsRect = el.getBoundingClientRect();
    const padX = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tab-ink-pad-x"))||0;
    const ml   = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tab-ink-ml"))||0;
    const left = Math.round(rect.left - tabsRect.left + ml);
    const width= Math.max(2, Math.round(rect.width + padX*2));
    // no animation on initial
    const prev = (ink as HTMLElement).style.transition;
    (ink as HTMLElement).style.transition = "none";
    (ink as HTMLElement).style.width = `${width}px`;
    (ink as HTMLElement).style.transform = `translateX(${left}px)`;
    void (ink as HTMLElement).offsetWidth;
    (ink as HTMLElement).style.transition = prev || "";
  }, [activeHref, tabs.length]);

  return (
    <div className="tabrow" aria-label="三级页签卡片行">
      <div className="tabrow-inner">
        <div className="tab-offset" aria-hidden="true"></div>
        <div className="tab-wrap">
          <div className="tabs" id="tabs" ref={tabsRef}>
            {tabs.map(t => (
              <a key={t.href} className={`tab ${t.href===activeHref?'active':''}`} data-sub={t.subHref} data-key={t.key} data-href={t.href}
                 href={t.href}
                 onClick={(e)=>{ e.preventDefault(); onClick && onClick(t.href); }}
              >
                <span className="tab__text">{t.text}</span>
              </a>
            ))}
          </div>
          {/* 卡片区留给页面自身 */}
          <div className={`tabcard${tabs.length ? '' : ' no-tabs'}`} id="tabCard">
            <div className="tabpanel" id="tabPanel">
              {tabs.length ? null : '该二级暂无页签内容。'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
