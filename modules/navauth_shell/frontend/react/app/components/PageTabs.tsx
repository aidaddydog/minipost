import React from "react";
import { Link } from "react-router-dom";

type Tab = { href: string; title?: string; text?: string };

export default function PageTabs({
  tabs, activePath, visualPath, onPickTab
}: {
  tabs: Tab[];
  activePath: string;
  visualPath: string;
  onPickTab: (href: string) => void;
}) {
  const barRef = React.useRef<HTMLDivElement | null>(null);
  const inkRef = React.useRef<HTMLSpanElement | null>(null);

  const updateInk = React.useCallback(() => {
    const bar = barRef.current;
    const ink = inkRef.current;
    if (!bar || !ink) return;
    const act = bar.querySelector<HTMLAnchorElement>('a[data-active="true"]');
    if (!act) {
      ink.style.opacity = '0';
      return;
    }
    const barRect = bar.getBoundingClientRect();
    const aRect = act.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tab-ink-pad-x')) || 8;
    const ml = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tab-ink-ml')) || 0;
    const width = Math.max(0, aRect.width - pad * 2);
    const left = aRect.left - barRect.left + bar.scrollLeft + pad + ml;
    ink.style.width = `${width}px`;
    ink.style.transform = `translateX(${left}px)`;
    ink.style.opacity = '1';
  }, []);

  React.useEffect(() => {
    updateInk();
    const onResize = () => updateInk();
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [updateInk, tabs.length, visualPath, activePath]);

  return (
    <div className="w-full bg-[var(--nav-l3-bg)] border-b" style={{ borderColor: "var(--nav-l2-sep)" }}>
      <div ref={barRef} className="tabs relative mx-auto w-full max-w-[1200px] h-[var(--nav-l3-height)] flex items-end px-4 gap-[var(--nav-l3-gap)] overflow-x-auto whitespace-nowrap">
        {/* Ink */}
        <span ref={inkRef} className="tab-ink absolute bottom-0" aria-hidden="true" />

        {tabs.map((t) => {
          const label = t.title || t.text || t.href;
          const active = visualPath === t.href;
          return (
            <Link
              key={t.href}
              to={t.href}
              data-active={active ? "true" : "false"}
              className="text-[13px]"
              style={{
                padding: `var(--nav-l3-py) var(--nav-l3-px)`,
                borderRadius: `var(--nav-l3-radius)`,
              }}
              onClick={(e) => { e.preventDefault(); onPickTab(t.href); }}
              onFocus={() => setTimeout(() => updateInk(), 0)}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
