export type L1 = { key: string; text: string; href: string; order?: number; hidden?: boolean };
export type L2 = { ownerKey: string; text: string; href: string; order?: number; hidden?: boolean };
export type Tab = { ownerHref: string; key: string; text: string; href: string; order?: number; hidden?: boolean };

export type NavModel = {
  l1: L1[];
  l2ByL1: Record<string, L2[]>;
  tabsDict: Record<string, Tab[]>;
};
