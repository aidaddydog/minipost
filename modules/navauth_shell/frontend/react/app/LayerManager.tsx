import React, { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { createPortal } from "react-dom";

type LayerItem = { id: number; node: ReactNode };
type Ctx = {
  mount(node: ReactNode): number;
  update(id: number, node: ReactNode): void;
  unmount(id: number): void;
};
const LayerCtx = createContext<Ctx | null>(null);

export function useLayer() {
  const ctx = useContext(LayerCtx);
  if (!ctx) throw new Error("useLayer must be used within <LayerManager/>");
  return ctx;
}

let uid = 1;

export const LayerManager: React.FC<{ children?: ReactNode }> = ({ children }) => {
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const api = useMemo<Ctx>(() => ({
    mount(node) {
      const id = uid++;
      setLayers(ls => [...ls, { id, node }]);
      return id;
    },
    update(id, node) { setLayers(ls => ls.map(l => l.id === id ? ({ id, node }) : l)); },
    unmount(id) { setLayers(ls => ls.filter(l => l.id !== id)); },
  }), []);
  return (
    <LayerCtx.Provider value={api}>
      {children}
      {createPortal(
        <div id="__layers__">
          {layers.map(l => <React.Fragment key={l.id}>{l.node}</React.Fragment>)}
        </div>,
        document.body
      )}
    </LayerCtx.Provider>
  );
};
