import React from "react";
import { Link } from "react-router-dom";

type Tab = { href: string; title?: string; text?: string };

export default function PageTabs({ tabs, activePath }: { tabs: Tab[]; activePath: string }) {
  return (
    <div className="w-full bg-[var(--nav-l3-bg)] border-b" style={{ borderColor: "var(--nav-l2-sep)" }}>
      <div className="mx-auto w-full max-w-[1200px] h-[var(--nav-l3-height)] flex items-end px-4 gap-[var(--nav-l3-gap)]">
        {tabs.map((t) => {
          const label = t.title || t.text || t.href;
          const active = activePath === t.href;
          return (
            <Link
              key={t.href}
              to={t.href}
              className="text-[13px] pb-2"
              style={{
                padding: `var(--nav-l3-py) var(--nav-l3-px)`,
                borderRadius: "var(--nav-l3-radius)",
                borderBottom: active ? `2px solid var(--nav-l3-underline)` : "2px solid transparent",
                color: active ? "inherit" : "inherit",
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
