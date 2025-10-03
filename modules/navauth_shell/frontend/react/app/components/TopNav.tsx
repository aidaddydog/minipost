import React, { useEffect, useRef } from "react";

export interface L1Item { path: string; text: string; }
export interface TopNavProps {
  items: L1Item[];
  activePath: string;
  onHover?: (path: string)=>void;
  onLeave?: ()=>void;
  onClick?: (path: string)=>void;
}

export default function TopNav({ items, activePath, onHover, onLeave, onClick }: TopNavProps){
  const trackRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const track = trackRef.current, pill = pillRef.current;
    if(!track || !pill) return;
    const el = track.querySelector<HTMLAnchorElement>(`a.link[data-path='${activePath}']`) || track.querySelector<HTMLAnchorElement>("a.link");
    if(!el) return;
    const left = el.offsetLeft - track.scrollLeft;
    const minw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--pill-minw")) || 60;
    const width= Math.max(minw, el.offsetWidth);
    pill.style.width = `${width}px`;
    pill.style.transform = `translate(${left}px,-50%)`;
    pill.style.opacity = "1";
  }, [activePath, items.length]);

  return (
    <div className="nav-rail" role="navigation" aria-label="主导航（一级）">
      <div className="track" id="navTrack" ref={trackRef}
           onPointerLeave={()=>onLeave && onLeave()}>
        <div className="pill" id="pill" ref={pillRef} aria-hidden="true" />
        {items.map(it => (
          <a key={it.path} className={`link ${it.path===activePath?'active':''}`}
             data-path={it.path} href={it.path}
             onPointerEnter={()=>onHover && onHover(it.path)}
             onClick={(e)=>{ e.preventDefault(); onClick && onClick(it.path);}}
          >{it.text}</a>
        ))}
      </div>
    </div>
  );
}
