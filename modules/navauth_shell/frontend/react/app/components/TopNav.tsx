import React, { useEffect, useImperativeHandle, useMemo, useRef } from "react";

export type L1Item = { text: string; path: string; href: string };
export type TopNavHandle = {
  movePillToPath: (path: string) => void;
  realign: () => void;
};

type Props = {
  items: L1Item[];
  lockedPath: string;
  hoverPath: string;
  inSubRow: boolean;
  onHoverPath: (path: string) => void;
  onLockPath: (path: string) => void;
};

function cssVarNum(name: string, fallback = 0) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

const TopNav = React.forwardRef<TopNavHandle, Props>(function TopNav(
  { items, lockedPath, hoverPath, inSubRow, onHoverPath, onLockPath }, ref
) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const graceMs = useMemo(() => cssVarNum("--sub-grace-ms", 220), []);

  function movePillToEl(el: HTMLElement | null) {
    const track = trackRef.current;
    const pill = pillRef.current;
    if (!track || !pill || !el) return;
    const left = el.offsetLeft - track.scrollLeft;
    const minw = cssVarNum("--pill-minw", 60);
    const width = Math.max(minw, el.offsetWidth);
    pill.style.width = `${width}px`;
    pill.style.transform = `translate(${left}px,-50%)`;
    pill.style.opacity = "1";
  }

  function movePillToPath(path: string) {
    const el = linkRefs.current[path];
    if (el) movePillToEl(el);
  }

  useImperativeHandle(ref, () => ({
    movePillToPath,
    realign() { movePillToPath(hoverPath || lockedPath); }
  }), [hoverPath, lockedPath]);

  // 初始 & 窗口变化时复位
  useEffect(() => {
    const onResize = () => movePillToPath(hoverPath || lockedPath);
    window.addEventListener("resize", onResize);
    const t = setTimeout(onResize, 0);
    return () => { window.removeEventListener("resize", onResize); clearTimeout(t); };
  }, [hoverPath, lockedPath]);

  // track 滚动时复位
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => movePillToPath(hoverPath || lockedPath);
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [hoverPath, lockedPath]);

  // hoverPath 变化 => pill 跟随
  useEffect(() => { movePillToPath(hoverPath || lockedPath); }, [hoverPath, lockedPath]);

  let leaveTimer: number | undefined;
  function handleTrackLeave() {
    window.clearTimeout(leaveTimer);
    leaveTimer = window.setTimeout(() => {
      if (!inSubRow) onHoverPath(lockedPath);
    }, graceMs);
  }

  return (
    <div className="nav-rail" role="navigation" aria-label="主导航（一级）">
      <div
        className="track"
        ref={trackRef}
        onPointerLeave={handleTrackLeave}
      >
        <div className="pill" ref={pillRef} aria-hidden="true" />
        {items.map(it => (
          <a
            key={it.path}
            ref={el => (linkRefs.current[it.path] = el)}
            className={"link" + (lockedPath === it.path ? " active" : "")}
            data-path={it.path}
            href={it.href}
            onPointerEnter={() => { if (!inSubRow) onHoverPath(it.path); }}
            onClick={(e) => {
              e.preventDefault();
              onLockPath(it.path);
            }}
          >{it.text}</a>
        ))}
      </div>
    </div>
  );
});

export default TopNav;
