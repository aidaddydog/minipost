import React from "react";
import { Link } from "react-router-dom";

type Item = { href: string; title?: string; text?: string; icon?: string };

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
            const active =
              activePath === it.href || activePath.startsWith(it.href + "/");
            return (
              <Link
                key={it.href}
                to={it.href}
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
