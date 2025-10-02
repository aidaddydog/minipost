import * as Dialog from "@radix-ui/react-dialog";
import React from "react";
import { useLayerManager, useRegisterLayer } from "../systems/LayerManager";

/** shadcn 风格对话框，不渲染 Overlay，Portal 到全局 layer-root */
export function LDialog({
  open,
  onOpenChange,
  title,
  size = "md",
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "full";
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { container } = useLayerManager();
  useRegisterLayer("modal", open);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {container && (
        <Dialog.Portal container={container}>
          <Dialog.Content asChild>
            <div className="fixed inset-0 z-[1030] grid place-items-center p-4">
              <div
                className={`bg-white rounded-xl shadow-xl w-[min(92vw,${
                  size === "sm" ? "560px" : size === "lg" ? "1200px" : size === "full" ? "96vw" : "920px"
                })] max-h-[90vh] flex flex-col`}
              >
                <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
                  <h3 className="text-base font-medium">{title}</h3>
                  <button aria-label="关闭" className="text-xl leading-none px-1" onClick={() => onOpenChange(false)}>
                    ×
                  </button>
                </div>
                <div className="p-4 overflow-auto">{children}</div>
                {footer && <div className="border-t p-3">{footer}</div>}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  );
}
