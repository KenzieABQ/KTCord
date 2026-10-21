"use client"

import { useSyncExternalStore } from "react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatKey, isApplePlatform, SHORTCUT_GROUPS } from "@/lib/shortcuts"

const noop = () => () => {}

/** Key names for this platform (⌘ on Apple devices); plain names during server rendering. */
function useApplePlatform() {
  return useSyncExternalStore(noop, isApplePlatform, () => false)
}

export function ShortcutList() {
  const apple = useApplePlatform()
  return (
    <div className="flex flex-col gap-6">
      {SHORTCUT_GROUPS.map((group) => (
        <section key={group.heading}>
          <h3 className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">{group.heading}</h3>
          <dl className="divide-y divide-border">
            {group.items.map((item) => (
              <div key={item.description} className="flex items-center justify-between gap-4 py-2">
                <dt className="text-sm text-foreground">{item.description}</dt>
                <dd className="flex shrink-0 gap-1">
                  {item.keys.map((key) => (
                    <kbd
                      key={key}
                      className="min-w-6 rounded border border-b-2 border-border bg-rail px-1.5 py-0.5 text-center font-sans text-xs font-semibold text-header"
                    >
                      {formatKey(key, apple)}
                    </kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}

/** Ctrl/⌘+/ : the keyboard shortcut cheat sheet. */
export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto bg-chat p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>Get around KTCord without reaching for the mouse.</DialogDescription>
        </DialogHeader>
        <div className="mt-2">
          <ShortcutList />
        </div>
      </DialogContent>
    </Dialog>
  )
}
