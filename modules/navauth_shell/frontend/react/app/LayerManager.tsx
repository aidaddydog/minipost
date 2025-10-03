import React, { createContext, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Layer = "modal" | "overlay" | "toast";
type LayerCtx = { ensure: (id: Layer) => HTMLElement };

const Ctx = createContext<LayerCtx | null>(null);

export const LayerManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [nodes] = useState(() => {
    const mk = (id: string) => {
      const el = document.getElementById(id) || Object.assign(document.createElement("div"), { id });
      if (!el.isConnected) document.body.appendChild(el);
      return el;
    };
    return { m: mk("layer-modal"), o: mk("layer-overlay"), t: mk("layer-toast") };
  });

  const ctx = useMemo<LayerCtx>(
    () => ({ ensure: (id) => (id === "modal" ? nodes.m : id === "overlay" ? nodes.o : nodes.t) }),
    [nodes]
  );
  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
};

export function useLayer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLayer must be used within <LayerManager>");
  return ctx;
}

export const Portal: React.FC<{ to: Layer; children: React.ReactNode }> = ({ to, children }) => {
  const { ensure } = useLayer();
  return createPortal(children, ensure(to));
};
