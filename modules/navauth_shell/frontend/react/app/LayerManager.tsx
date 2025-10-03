import React, { ReactNode } from "react";
import { createPortal } from "react-dom";

type Entry = { id: number; node: ReactNode };
class LayerManagerImpl {
  private host: HTMLElement | null = null;
  private entries: Entry[] = [];
  private idSeq = 1;

  private ensureHost() {
    if (!this.host) {
      const el = document.createElement("div");
      el.id = "layer-host";
      Object.assign(el.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: "2147483647" });
      document.body.appendChild(el);
      this.host = el;
    }
  }

  mount(node: ReactNode) {
    this.ensureHost();
    const id = this.idSeq++;
    this.entries.push({ id, node });
    this.rerender();
    return id;
  }

  update(id: number, node: ReactNode) {
    const it = this.entries.find(e => e.id === id);
    if (it) { it.node = node; this.rerender(); }
  }

  unmount(id: number) {
    this.entries = this.entries.filter(e => e.id !== id);
    this.rerender();
  }

  private rerender() {
    if (!this.host) return;
    const content = (
      <>
        {this.entries.map(e => (
          <div key={e.id} style={{ pointerEvents: "auto" }}>{e.node}</div>
        ))}
      </>
    );
    // Render once per microtask (cheap batching)
    Promise.resolve().then(() => {
      if (!this.host) return;
      const vnode = createPortal(content, this.host!);
      // store on window for devtools (optional)
      (window as any).__LAYER_VNODE__ = vnode;
    });
  }
}
const LayerManager = new LayerManagerImpl();
export default LayerManager;
