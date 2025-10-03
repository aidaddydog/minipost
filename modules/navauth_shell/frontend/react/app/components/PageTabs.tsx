import React, { useEffect, useMemo, useRef } from "react";

export type TabItem = { key?: string; text: string; href: string };

type Props = {
  tabs: TabItem[];
  lockedTabHref: string;
  onLockTab: (href: string) => void;
};

function cssVarNum(name: string, fallback = 0) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

const PageTabs: React.FC<Props> = ({ tabs, lockedTabHref, onLockTab }) => {
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const inkRef = useRef<HTMLSpanElement | null>(null);

  const padX = useMemo(() => cssVarNum("--tab-ink-pad-x", 0), []);
  const ml   = useMemo(() => cssVarNum("--tab-ink-ml", 0), []);

  function ensureInk(): HTMLSpanElement | null {
    let ink = inkRef.current;
    if (!ink && tabsRef.current) {
      ink = document.createElement("span");
      ink.className = "tab-ink";
      tabsRef.current.appendChild(ink);
      inkRef.current = ink;
    }
    return ink || null;
  }

  function positionInk(target: HTMLElement | null, animate: boolean) {
    const ink = ensureInk();
    const root = tabsRef.current;
    if (!ink || !root || !target) return;
    const txt = target.querySelector(".tab__text") as HTMLElement || target;
    const rect = txt.getBoundingClientRect();
    const base = root.getBoundingClientRect();
    const left = Math.round(rect.left - base.left + ml);
    const width = Math.max(2, Math.round(rect.width + padX * 2));
    if (!animate) {
      const prev = ink.style.transition;
      ink.style.transition = "none";
      ink.style.width = width + "px";
      ink.style.transform = `translateX(${left}px)`;
      void ink.offsetWidth;
      ink.style.transition = prev || "";
    } else {
      ink.style.width = width + "px";
      ink.style.transform = `translateX(${left}px)`;
    }
  }

  useEffect(() => {
    const root = tabsRef.current;
    function realign() {
      const a = root?.querySelector<HTMLAnchorElement>('a.tab.active');
      positionInk(a || null, false);
    }
    window.addEventListener("resize", realign);
    const t = setTimeout(realign, 0);
    return () => { window.removeEventListener("resize", realign); clearTimeout(t); };
  }, [tabs, lockedTabHref]);

  return (
    <div className="tabrow" aria-label="三级页签卡片行">
      <div className="tabrow-inner">
        <div className="tab-offset" aria-hidden="true"></div>
        <div className="tab-wrap">
          <div className="tabs" ref={tabsRef}>
            {tabs.map(t => {
              const active = t.href === lockedTabHref;
              return (
                <a
                  key={t.href}
                  className={"tab" + (active ? " active" : "")}
                  data-key={t.key || ""}
                  href={t.href}
                  onClick={(e) => {
                    e.preventDefault();
                    onLockTab(t.href);
                    // 点击时才动画
                    const el = (e.currentTarget as HTMLAnchorElement);
                    positionInk(el, true);
                  }}
                >
                  <span className="tab__text">{t.text}</span>
                </a>
              );
            })}
          </div>
          {/* tab 内容容器由上层页面承接，这里只负责页签外观/交互 */}
        </div>
      </div>
    </div>
  );
};

export default PageTabs;
