import React, { useEffect, useMemo, useRef } from "react";
import type { L1 } from "./types";

export const TopNav: React.FC<{
  items: L1[];
  activePath: string;
}> = ({ items, activePath }) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);

  const idx = useMemo(() => {
    const n = items.findIndex(i => i.href === activePath);
    return n >= 0 ? n : -1;
  }, [items, activePath]);

  useEffect(() => {
    const track = trackRef.current, pill = pillRef.current;
    if (!track || !pill) return;
    if (idx < 0) {
      pill.style.opacity = "0";
      return;
    }
    const link = track.querySelectorAll<HTMLAnchorElement>(".link")[idx];
    if (!link) return;
    const left = link.offsetLeft - (track as HTMLElement).scrollLeft;
    const minw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--pill-minw")) || 60;
    const width = Math.max(minw, link.offsetWidth);
    pill.style.width = width + "px";
    pill.style.transform = `translate(${left}px,-50%)`;
    pill.style.opacity = "1";
  }, [idx, items]);

  return (
    <div className="nav-rail" role="navigation" aria-label="主导航（一级）">
      <div ref={trackRef} className="track">
        <div ref={pillRef} className="pill" aria-hidden="true" />
        {items.map((i) => (
          <a key={i.key} className={"link" + (i.href === activePath ? " active" : "")} href={i.href}>
            {i.text}
          </a>
        ))}
      </div>
    </div>
  );
};
