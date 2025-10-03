import React from "react";
import { Link } from "react-router-dom";

type Item = { href: string; title?: string; text?: string };

export default function SubNav({ items, activePath }: { items: Item[]; activePath: string }) {
  return (
    <div className="w-full border-b bg-[var(--nav-l2-bg)]" style={{ borderColor: "var(--nav-l2-sep)" }}>
      <div className="mx-auto w-full max-w-[1200px] h-[var(--nav-l2-height)] flex items-center px-4 gap-2">
        {items.map((it) => {
          const label = it.title || it.text || it.href;
          const active = activePath === it.href || activePath.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              to={it.href}
              className="text-[13px]"
              style={{
                padding: `var(--nav-l2-item-py) var(--nav-l2-item-px)`,
                borderRadius: "var(--nav-l2-item-radius)",
                background: active ? "var(--nav-l2-item-active-bg)" : "transparent",
                color: active ? "var(--nav-l2-item-active-fg)" : "inherit",
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background =
                  "var(--nav-l2-item-hover-bg)";
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
