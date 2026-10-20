"use client"

import { PlusIcon, UsersIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** Channel-sidebar content for the Home view: search, Friends, and the DM list. */
export function HomeSidebar() {
  const pathname = usePathname()
  const friendsActive = pathname === "/channels/me"

  return (
    <>
      <div className="flex h-12 shrink-0 items-center px-2.5 shadow-[0_1px_0_rgb(0_0_0/0.2)]">
        <button
          type="button"
          className="h-7 w-full truncate rounded-md bg-rail px-2 text-left text-sm text-muted-foreground"
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
          Friends
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
                className="text-interactive hover:text-interactive-hover"
              >
                <PlusIcon className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Create DM</TooltipContent>
          </Tooltip>
        </div>

        {/* Direct messages render here (Milestone 6). */}
        <p className="px-2.5 py-2 text-sm text-muted-foreground">
          No conversations yet.
        </p>
      </div>
    </>
  )
}
