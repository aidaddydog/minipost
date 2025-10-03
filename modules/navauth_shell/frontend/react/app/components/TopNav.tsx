import React from "react";
import { Link } from "react-router-dom";

type Item = { href: string; title?: string; text?: string; icon?: string };
type AnyObj = Record<string, any>;

function resolveFirstTabHref(l1Href: string): string {
  const nav: AnyObj | undefined = (window as any).__navjson;
  if (!nav) return l1Href;

  // 先找 L1 -> L2 -> 第一个 tab
  const items = (nav.items || []) as any[];
  const l1 = items.find((it: any) => (it.href || it.path) === l1Href);
  const l2 = l1 ? (l1.children || l1.items || []) : [];
  if (Array.isArray(l2) && l2.length) {
    const base = l2[0].href || l2[0].path || l1Href;
    const tabs = (nav.tabs && nav.tabs[base]) || [];
    if (Array.isArray(tabs) && tabs.length) return tabs[0].href || base;
    return base;
  }

  // 再直接从 tabs 字典查
  const tabsDict = nav.tabs || {};
  const tabs = tabsDict[l1Href] || [];
  if (Array.isArray(tabs) && tabs.length) return tabs[0].href || l1Href;

  return l1Href;
}

export default function TopNav({ items, activePath }: { items: Item[]; activePath: string }) {
  return (
    <header
      className="sticky top-0 z-40 w-full border-b bg-[var(--nav-l1-bg)]"
      style={{ boxShadow: "var(--nav-l1-shadow)" }}
    >
      <div className="mx-auto w-full max-w-[1200px] flex items-center justify-between h-[var(--nav-l1-height)] px-4">
        {/* 左侧：品牌/Logo（可按需替换） */}
        <Link to="/" className="font-semibold text-[15px]">minipost</Link>

        {/* 右侧：一级菜单（胶囊样式） */}
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
            const target = resolveFirstTabHref(it.href);
            const active =
              activePath === it.href ||
              activePath.startsWith(it.href + "/") ||
              activePath === target ||
              activePath.startsWith(target + "/");
            return (
              <Link
                key={it.href}
                to={target}                 /* ← 直达第一个可渲染的 tab 路径 */
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
