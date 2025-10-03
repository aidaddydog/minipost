import React from "react";

export interface L2Item { text: string; href: string; owner: string; }
export interface SubNavProps {
  items: L2Item[];
  activeHref: string;
  onClick?: (href: string)=>void;
}

export default function SubNav({ items, activeHref, onClick }: SubNavProps){
  return (
    <div className="subrow" aria-label="次级导航整行">
      <div className="subrow-inner">
        <div className="subbar-offset" aria-hidden="true"></div>
        <div className="subbar">
          <div className="sub-inner">
            {items.map(s => (
              <a key={s.href} className={`sub ${s.href===activeHref?'active':''}`} href={s.href}
                 onClick={(e)=>{ e.preventDefault(); onClick && onClick(s.href); }}
              >{s.text}</a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
