import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";

type Item = { title?: string; path?: string; href?: string; children?: Item[] };

async function fetchNav(): Promise<{ items?: Item[] }> {
  try {
    const r = await fetch("/api/nav", { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  } catch {
    return { items: [] };
  }
}

export function ShellLayout() {
  const [items, setItems] = React.useState<Item[]>([]);
  const loc = useLocation();

  React.useEffect(() => {
    fetchNav().then((d) => setItems(d.items || []));
  }, []);

  const activeL1 = items.find((it) =>
    loc.pathname.startsWith((it.href || it.path || "").replace(/\/$/, "")),
  );

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-screen-xl h-14 px-6 flex items-center justify-between">
          <div className="font-semibold tracking-wide">minipost</div>
          <nav className="flex items-center gap-2 text-sm">
            {items.map((it) => {
              const href = (it.href || it.path) ?? "#";
              const active = loc.pathname.startsWith(href.replace(/\/$/, ""));
              return (
                <Link
                  key={href}
                  to={href}
                  className={
                    "px-3 py-1.5 rounded " +
                    (active
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:text-slate-900 hover:bg-slate-100")
                  }
                >
                  {it.title || href}
                </Link>
              );
            })}
          </nav>
          <div className="text-xs text-slate-500">React 外壳</div>
        </div>
        {/* L2 */}
        {activeL1?.children?.length ? (
          <div className="border-t bg-white">
            <div className="mx-auto max-w-screen-xl px-6 h-10 flex items-center gap-2">
              {activeL1.children.map((c) => {
                const href = (c.href || c.path) ?? "#";
                const active = loc.pathname.startsWith(href.replace(/\/$/, ""));
                return (
                  <Link
                    key={href}
                    to={href}
                    className={
                      "px-2 py-1 rounded text-sm " +
                      (active
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900")
                    }
                  >
                    {c.title || href}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-screen-xl px-6 py-4">
        <Outlet />
      </main>
    </div>
  );
}
