import React, { useEffect, useMemo, useRef } from "react";
import type { L1 } from "./types";

/** 设计稿一致：始终渲染灰轨；当 L1 为空时仅隐藏 pill */
export const TopNav: React.FC<{
  items: L1[];
  activePath: string;
}> = ({ items, activePath }) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);

  const activeIdx = useMemo(() => {
    const i = items.findIndex((it) => it.href === activePath);
    return i >= 0 ? i : -1;
  }, [items, activePath]);

  useEffect(() => {
    const track = trackRef.current;
    const pill = pillRef.current;
    if (!track || !pill) return;

    const links = Array.from(track.querySelectorAll<HTMLAnchorElement>("a.link"));

    function position() {
      if (activeIdx >= 0 && links[activeIdx]) {
        const el = links[activeIdx];
        const host = track.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const x = r.left - host.left;
        const w = r.width;

        pill.style.opacity = "1";
        pill.style.width = `${w}px`;
        pill.style.transform = `translateX(${x}px)`;
      } else {
        // 无激活项（或无项）→ 隐藏 pill，但轨道仍显示
        pill.style.opacity = "0";
        pill.style.width = "0px";
        pill.style.transform = "translateX(0)";
      }
    }

    position();
    // 首次渲染/字体加载/窗口尺寸变化都重新定位
    const tid = window.setTimeout(position, 50);
    const onResize = () => position();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(tid);
    };
  }, [activeIdx, items.length]);

  return (
    <div className="nav-rail" role="navigation" aria-label="主导航（一级）">
      <div ref={trackRef} className="track">
        <div ref={pillRef} className="pill" aria-hidden="true" />
        {items.map((i) => (
          <a
            key={i.key}
            className={"link" + (i.href === activePath ? " active" : "")}
            href={i.href}
          >
            {i.text}
          </a>
        ))}
      </div>
    </div>
  );
};
