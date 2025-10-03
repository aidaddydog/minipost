import React from "react";
import { Link } from "react-router-dom";

type Item = { href: string; title?: string; text?: string };

export default function SubNav({
  items, activePath, visualPath, onHoverL2, onLeaveL2, onPickL2
}: {
  items: Item[];
  activePath: string;
  visualPath: string;
  onHoverL2: (href: string | null) => void;
  onLeaveL2: () => void;
  onPickL2: (href: string) => void;
}) {
  return (
    <div className="w-full border-b bg-[var(--nav-l2-bg)]" style={{ borderColor: "var(--nav-l2-sep)" }}
         onMouseLeave={onLeaveL2}>
      <div className="mx-auto w-full max-w-[1200px] h-[var(--nav-l2-height)] flex items-center px-4 gap-2">
        {items.map((it) => {
          const label = it.title || it.text || it.href;
          const active = visualPath === it.href || visualPath.startsWith((it.href || "") + "/");
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
              onMouseEnter={() => onHoverL2(it.href)}
              onClick={(e) => { e.preventDefault(); onPickL2(it.href); }}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
