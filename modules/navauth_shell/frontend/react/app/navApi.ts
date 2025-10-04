import type { L1, L2, Tab, NavModel } from "./types";

const empty: NavModel = { l1: [], l2ByL1: {}, tabsDict: {} };

/** 读取 /api/nav（新架构：{ menu: object, tabs: object }），并转换为前端模型 */
export async function loadNav(): Promise<NavModel> {
  try {
    const r = await fetch("/api/nav", { headers: { accept: "application/json" } });
    if (r.status === 401) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.href = `/login?next=${next}`;
      return empty;
    }
    if (!r.ok) return empty;
    const j = await r.json();

    const menuObj: Record<string, any[]> = (j && typeof j.menu === "object" && j.menu) ? j.menu : {};
    const tabsObj: Record<string, any[]> = (j && typeof j.tabs === "object" && j.tabs) ? j.tabs : {};

    const l1: L1[] = [];
    const l2ByL1: Record<string, L2[]> = {};
    const tabsDict: Record<string, Tab[]> = {};

    // 统一：把 L1 的 href 定义为其 L2 的“基础路径”（/orders、/products 等）
    const baseOf = (href: string): string => {
      if (typeof href !== "string" || !href.startsWith("/")) return "/";
      const seg = href.split("/").filter(Boolean)[0];
      return seg ? ("/" + seg) : "/";
    };

    // 1) 解析 menu（L1 → L2 列表），顺便生成 L1
    Object.entries(menuObj).forEach(([l1Title, items]) => {
      const arr = Array.isArray(items) ? items : [];

      // 基础路径：优先取 default=true 的 L2，否则取第一项
      const first = (arr.find((x: any) => x && x.default) ?? arr[0]) || null;
      const ownerKey = first ? baseOf(String(first.href || "")) : "/";

      // L2 列表
      const l2s: L2[] = arr
        .filter((x: any) => x && typeof x.href === "string")
        .map((x: any) => ({
          ownerKey,
          text: String(x.text ?? ""),
          href: String(x.href ?? "/"),
          order: Number.isFinite(+x.order) ? +x.order : 100,
        }))
        .sort((a, b) => (a.order! - b.order!));
      if (l2s.length) l2ByL1[ownerKey] = l2s;

      // L1 条目：使用 L1 文本作为显示文案，href 采用基础路径
      l1.push({
        key: ownerKey,
        text: String(l1Title || ""),
        href: ownerKey,
        order: (l2s.length ? (l2s[0].order ?? 100) : 100),
      });
    });

    l1.sort((a, b) => (a.order! - b.order!));

    // 2) 解析 tabs（/二级路径 → 三级页签列表）
    Object.entries(tabsObj).forEach(([ownerHref, items]) => {
      const arr = Array.isArray(items) ? items : [];
      tabsDict[ownerHref] = arr
        .filter((t: any) => t && typeof t.href === "string")
        .map((t: any) => ({
          ownerHref,
          key: String(t.key ?? t.href ?? t.text ?? ""),
          text: String(t.text ?? ""),
          href: String(t.href ?? "/"),
          order: Number.isFinite(+t.order) ? +t.order : 9999,
        }))
        .sort((a, b) => (a.order! - b.order!));
    });

    return { l1, l2ByL1, tabsDict };
  } catch {
    return empty;
  }
}
