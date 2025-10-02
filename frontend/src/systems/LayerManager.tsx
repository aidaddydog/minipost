import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Kind = "modal" | "drawer" | "popover" | "tooltip";
type Entry = { id: number; kind: Kind; visible: boolean };
type Ctx = {
  container: HTMLElement | null;
  register: (kind: Kind, visible: boolean) => number;
  update: (id: number, visible: boolean) => void;
  unregister: (id: number) => void;
  counts: Record<Kind, number>;
};

const C = createContext<Ctx | null>(null);

export function LayerProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<Map<number, Entry>>(new Map());
  const idRef = useRef(1);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let el = document.getElementById("layer-root") as HTMLElement | null;
    if (!el) {
      el = document.createElement("div");
      el.id = "layer-root";
      el.setAttribute("data-layer-host", "true");
      document.body.appendChild(el);
    }
    setContainer(el);
  }, []);

  const counts = useMemo(() => {
    const c: Record<Kind, number> = { modal: 0, drawer: 0, popover: 0, tooltip: 0 };
    entries.forEach((e) => e.visible && (c[e.kind]++));
    return c;
  }, [entries]);

  useEffect(() => {
    const locked = counts.modal + counts.drawer > 0;
    const flag = locked ? "true" : "false";
    document.documentElement.setAttribute("data-layer-locked", flag);
    document.body.setAttribute("data-layer-locked", flag);
  }, [counts.modal, counts.drawer]);

  const api: Ctx = {
    container,
    register: (kind, visible) => {
      const id = idRef.current++;
      setEntries((m) => new Map(m).set(id, { id, kind, visible }));
      return id;
    },
    update: (id, visible) => {
      setEntries((m) => {
        const n = new Map(m);
        const e = n.get(id);
        if (e) n.set(id, { ...e, visible });
        return n;
      });
    },
    unregister: (id) => setEntries((m) => { const n = new Map(m); n.delete(id); return n; }),
    counts,
  };

  const showBackdrop = counts.modal + counts.drawer > 0;

  return (
    <C.Provider value={api}>
      {children}
      {container && createPortal(<div className={"lm-backdrop" + (showBackdrop ? " show" : "")} />, container)}
    </C.Provider>
  );
}

export function useLayerManager() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useLayerManager must be used inside <LayerProvider>");
  return ctx;
}

export function useRegisterLayer(kind: Kind, visible: boolean) {
  const { register, update, unregister } = useLayerManager();
  const idRef = useRef<number | null>(null);
  useEffect(() => {
    idRef.current = register(kind, visible);
    return () => { if (idRef.current != null) unregister(idRef.current); };
  }, []);
  useEffect(() => { if (idRef.current != null) update(idRef.current, visible); }, [visible]);
}
