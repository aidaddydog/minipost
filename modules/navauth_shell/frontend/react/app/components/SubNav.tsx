import React, { useMemo } from "react";
import type { L1Item, TopNavHandle } from "./TopNav";

export type L2Item = { text: string; href: string; ownerPath: string };

type Props = {
  owner: L1Item | null;
  items: L2Item[];
  lockedSubHref: string;
  onLockSub: (href: string) => void;
  onPointerZone: (inZone: boolean) => void;
  topNavRef: React.RefObject<TopNavHandle>;
};

function cssVarNum(name: string, fallback = 0) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

const SubNav: React.FC<Props> = ({ owner, items, lockedSubHref, onLockSub, onPointerZone, topNavRef }) => {
  const grace = useMemo(() => cssVarNum("--sub-grace-ms", 220), []);

  let leaveTimer: number | undefined;
  function handleEnter() {
    window.clearTimeout(leaveTimer);
    onPointerZone(true);
  }
  function handleLeave() {
    window.clearTimeout(leaveTimer);
    leaveTimer = window.setTimeout(() => onPointerZone(false), grace);
  }

  return (
    <div className="subrow" onPointerEnter={handleEnter} onPointerLeave={handleLeave} aria-label="次级导航整行">
      <div className="subrow-inner">
        <div className="subbar-offset" aria-hidden="true"></div>
        <div className="subbar">
          <div className="sub-inner">
            {items.map(s => (
              <a
                key={s.href}
                className={"sub" + (lockedSubHref === s.href ? " active" : "")}
                data-owner={s.ownerPath}
                href={s.href}
                onPointerOver={() => topNavRef.current?.movePillToPath(s.ownerPath)}
                onClick={(e) => { e.preventDefault(); onLockSub(s.href); }}
              >{s.text}</a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubNav;
