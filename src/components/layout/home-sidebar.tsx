"use client"

import { PlusIcon, UsersIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { DmList } from "@/components/dms/dm-list"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useRelationships } from "@/lib/queries/social"
import { useUiStore } from "@/lib/stores/ui-store"
import { cn } from "@/lib/utils"

/** Channel-sidebar content for the Home view: search, Friends, and the DM list. */
export function HomeSidebar() {
  const pathname = usePathname()
  const openDialog = useUiStore((s) => s.openDialog)
  const { data: relationships } = useRelationships()
  const friendsActive = pathname === "/channels/me"
  const incoming = relationships?.filter((r) => r.kind === "incoming").length ?? 0

  return (
    <>
      <div className="flex h-12 shrink-0 items-center px-2.5 shadow-[0_1px_0_rgb(0_0_0/0.2)]">
        <button
          type="button"
          onClick={() => openDialog({ kind: "quick-switcher" })}
          className="h-7 w-full truncate rounded-md bg-rail px-2 text-left text-sm text-muted-foreground hover:text-interactive-hover"
        >
          Find or start a conversation
        </button>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-2 py-2">
        <Link
          href="/channels/me"
          className={cn(
            "flex h-10 items-center gap-3 rounded-md px-3 text-[15px] font-medium transition-colors",
            friendsActive
              ? "bg-item-selected text-interactive-active"
              : "text-interactive hover:bg-item-hover hover:text-interactive-hover"
          )}
        >
          <UsersIcon className="size-5" />
          <span className="flex-1">Friends</span>
          {incoming > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-mention px-1 text-[11px] font-bold text-white">
              {incoming}
            </span>
          )}
        </Link>

        <div className="mt-4 mb-1 flex items-center justify-between pr-1 pl-2.5">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-interactive-hover">
            Direct Messages
          </h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Create DM"
                onClick={() => openDialog({ kind: "create-dm" })}
                className="text-interactive hover:text-interactive-hover"
              >
                <PlusIcon className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Create DM</TooltipContent>
          </Tooltip>
        </div>

        <DmList />
      </div>
    </>
  )
}
