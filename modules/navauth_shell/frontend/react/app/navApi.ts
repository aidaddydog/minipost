import type { L1, L2, Tab, NavModel } from "./types";

const empty: NavModel = { l1: [], l2ByL1: {}, tabsDict: {} };

/** 仅支持新框架：/api/nav 返回 { l1:[], l2:[], tabs:[] } */
export async function loadNav(): Promise<NavModel> {
  try {
    const r = await fetch("/api/nav", { headers: { accept: "application/json" } });
    if (!r.ok) return empty;
    const j = await r.json();

    // 新框架：扁平化 l1/l2/tabs
    const l1raw: any[] = Array.isArray(j?.l1) ? j.l1 : [];
    const l2raw: any[] = Array.isArray(j?.l2) ? j.l2 : [];
    const tabsRaw: any[] = Array.isArray(j?.tabs) ? j.tabs : [];

    const l1: L1[] = l1raw
      .filter(x => x && !x.hidden)
      .map(x => ({
        key: String(x.key ?? x.href ?? x.text ?? ""),
        text: String(x.text ?? ""),
        href: String(x.href ?? "/"),
        order: Number.isFinite(+x.order) ? +x.order : 9999,
      }))
      .sort((a, b) => (a.order! - b.order!));

    const l2ByL1: Record<string, L2[]> = {};
    for (const s of l2raw) {
      if (!s || s.hidden) continue;
      const owner = String(s.ownerKey ?? s.owner ?? "");
      if (!owner) continue;
      (l2ByL1[owner] ||= []).push({
        ownerKey: owner,
        text: String(s.text ?? ""),
        href: String(s.href ?? "/"),
        order: Number.isFinite(+s.order) ? +s.order : 9999,
      });
    }
    Object.values(l2ByL1).forEach(arr => arr.sort((a, b) => (a.order! - b.order!)));

    const tabsDict: Record<string, Tab[]> = {};
    for (const t of tabsRaw) {
      if (!t || t.hidden) continue;
      const ownerHref = String(t.ownerHref ?? t.owner ?? "");
      if (!ownerHref) continue;
      (tabsDict[ownerHref] ||= []).push({
        ownerHref,
        key: String(t.key ?? t.href ?? t.text ?? ""),
        text: String(t.text ?? ""),
        href: String(t.href ?? "/"),
        order: Number.isFinite(+t.order) ? +t.order : 9999,
      });
    }
    Object.values(tabsDict).forEach(arr => arr.sort((a, b) => (a.order! - b.order!)));

    return { l1, l2ByL1, tabsDict };
  } catch {
    return empty;
  }
}
