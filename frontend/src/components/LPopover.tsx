import * as Popover from "@radix-ui/react-popover"
import React from "react"
import { useLayerManager, useRegisterLayer } from "../systems/LayerManager"

export function LPopover({ open, onOpenChange, trigger, children } : { open: boolean; onOpenChange:(v:boolean)=>void; trigger: React.ReactNode; children?: React.ReactNode; }){
  const { container } = useLayerManager()
  useRegisterLayer("popover", open)
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      {container && (
        <Popover.Portal container={container}>
          <Popover.Content sideOffset={8} className="z-[1010] rounded-md border bg-white p-2 shadow-md will-change-transform">
            {children}
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  )
}
