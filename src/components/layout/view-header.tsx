"use client"

import { MenuIcon } from "lucide-react"
import type { ReactNode } from "react"

import { useUiStore } from "@/lib/stores/ui-store"
import { cn } from "@/lib/utils"

/** The 48px bar at the top of the main panel. On phones it starts with a button that opens the nav drawer. */
export function ViewHeader({
  children,
  actions,
  className,
}: {
  children: ReactNode
  actions?: ReactNode
  className?: string
}) {
  const setNavDrawerOpen = useUiStore((s) => s.setNavDrawerOpen)

  return (
    <header
      className={cn(
        "relative z-10 flex h-12 shrink-0 items-center gap-2 px-2 border-b border-border sm:px-4",
        className
      )}
    >
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setNavDrawerOpen(true)}
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-interactive hover:bg-item-hover hover:text-interactive-hover md:hidden"
      >
        <MenuIcon className="size-5" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  )
}
