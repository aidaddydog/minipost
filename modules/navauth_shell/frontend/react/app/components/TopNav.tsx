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
  items, activePath, l2ByL1, tabsDict,
}: {
  items: Item[];
  activePath: string;
  l2ByL1: L2Map;
  tabsDict: TabsDict;
}) {
  return (
    <header
      className="sticky top-0 z-40 w-full border-b bg-[var(--nav-l1-bg)]"
      style={{ boxShadow: "var(--nav-l1-shadow)" }}
    >
      <div className="mx-auto w-full max-w-[1200px] flex items-center justify-between h-[var(--nav-l1-height)] px-4">
        <a href="/" className="font-semibold text-[15px]">minipost</a>

        <nav
          className="flex items-center"
          style={{
            gap: "var(--nav-l1-item-gap)",
            border: `1px solid var(--nav-l1-border)`,
            borderRadius: "var(--nav-l1-radius)",
            padding: "4px",
            background: "var(--nav-l1-bg)",
          }}
        >
          {items.map((it) => {
            const label = it.title || it.text || it.href;
            const target = firstRenderableTab(it.href, l2ByL1, tabsDict);
            const active =
              activePath === it.href ||
              activePath.startsWith(it.href + "/") ||
              activePath === target ||
              activePath.startsWith(target + "/");
            return (
              <Link
                key={it.href}
                to={target}
                className="text-sm"
                style={{
                  padding: `var(--nav-l1-item-py) var(--nav-l1-item-px)`,
                  borderRadius: "var(--nav-l1-radius)",
                  background: active ? "var(--nav-l1-item-active-bg)" : "transparent",
                  color: active ? "var(--nav-l1-item-active-fg)" : "inherit",
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background =
                    "var(--nav-l1-item-hover-bg)";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
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
