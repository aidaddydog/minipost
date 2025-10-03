import React from "react";
import { Link } from "react-router-dom";

type Item = { href: string; title?: string; text?: string };
type L2Map = Record<string, Array<{ href: string; title?: string; text?: string }>>;
type TabsDict = Record<string, Array<{ href: string; title?: string; text?: string }>>;

/** 根据 L1 href 解析“第一个可渲染 tab” */
function firstRenderableTab(l1Href: string, l2ByL1: L2Map, tabsDict: TabsDict): string {
  const l2 = l2ByL1[l1Href] || [];
  if (l2.length) {
    const base = l2[0].href || l1Href;
    const t = tabsDict[base] || [];
    if (t.length) return t[0].href || base;
    return base;
  }
  const t = tabsDict[l1Href] || [];
  if (t.length) return t[0].href || l1Href;
  return l1Href;
}

export default function TopNav({
  items, activePath, visualPath, l2ByL1, tabsDict,
  onHoverL1, onLeaveHeader, onPickL1,
}: {
  items: Item[];
  activePath: string;           // 实际路由（用于高亮保底）
  visualPath: string;           // 可视路径（hover 优先）
  l2ByL1: L2Map;
  tabsDict: TabsDict;
  onHoverL1: (href: string | null) => void;
  onLeaveHeader: () => void;
  onPickL1: (href: string) => void;
}) {
  const railRef = React.useRef<HTMLDivElement | null>(null);
  const pillRef = React.useRef<HTMLSpanElement | null>(null);
  const [pill, setPill] = React.useState<{left: number; width: number} | null>(null);

  // 当前“可视 L1”
  const visualL1 = React.useMemo(() => {
    const list = items
      .filter((it) => visualPath === it.href || visualPath.startsWith((it.href || "/") + "/"))
      .sort((a, b) => (b.href?.length || 0) - (a.href?.length || 0));
    return list[0] || items[0];
  }, [items, visualPath]);

  // 计算 pill 位置（跟随 visualL1）
  const recalc = React.useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const link = rail.querySelector<HTMLAnchorElement>(`a[data-href="${visualL1?.href}"]`);
    if (!link) return;
    const railRect = rail.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    const padLeft = parseFloat(getComputedStyle(rail).paddingLeft || "0") || 0;
    const left = linkRect.left - railRect.left + rail.scrollLeft - padLeft;
    const minW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--pill-minw") || "56") || 56;
    const width = Math.max(linkRect.width, minW);
    setPill({ left, width });
  }, [visualL1]);

  React.useEffect(() => { recalc(); }, [recalc, items.length]);

  // 滚动/缩放时重新定位
  React.useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const onScroll = () => recalc();
    const onResize = () => recalc();
    rail.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      rail.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [recalc]);

  return (
    <header className="w-full border-b bg-[var(--nav-l1-bg)]" style={{ borderColor: "var(--nav-l1-border)" }}
            onMouseLeave={onLeaveHeader}>
      <div className="mx-auto w-full max-w-[1200px] h-[var(--nav-l1-height)] flex items-center px-4">
        <nav ref={railRef} className="nav-rail relative w-full overflow-x-auto whitespace-nowrap pr-2">
          {/* pill */}
          <span ref={pillRef}
                className="pill absolute top-1/2 -translate-y-1/2 pointer-events-none"
                style={pill ? {
                  width: `${pill.width}px`,
                  transform: `translateX(${pill.left}px) translateY(-50%)`,
                } : { display: "none" }} />

          {/* 项 */}
          {items.map((it) => {
            const label = it.title || it.text || it.href;
            const href = it.href;
            const active = visualPath === href || visualPath.startsWith((href || "/") + "/");
            return (
              <Link
                key={href}
                data-href={href}
                to={firstRenderableTab(href, l2ByL1, tabsDict)}
                className="inline-block text-[13px] select-none"
                style={{
                  padding: `var(--nav-l1-item-py) var(--nav-l1-item-px)`,
                  borderRadius: "var(--nav-l1-radius)",
                  background: active ? "var(--nav-l1-item-active-bg)" : "transparent",
                  color: active ? "var(--nav-l1-item-active-fg)" : "inherit",
                }}
                onMouseEnter={() => onHoverL1(href)}
                onClick={(e) => { e.preventDefault(); onPickL1(href); }}
                onFocus={() => onHoverL1(href)}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
