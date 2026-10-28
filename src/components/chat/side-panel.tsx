"use client"

import { SearchIcon, XIcon } from "lucide-react"
import { useRef, useState, type ReactNode } from "react"

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useBreakpoint } from "@/hooks/use-breakpoint"
import { useSwipe } from "@/hooks/use-swipe"
import { useUiStore } from "@/lib/stores/ui-store"
import { cn } from "@/lib/utils"

import { useChat } from "./chat-context"
import { SEARCH_HINT, SearchPanel } from "./search-panel"
import { ThreadPanel } from "./thread-panel"

/**
 * The thread or search panel for this channel, if one is open. Desktop shows it as a
 * right-hand column (in place of the member list); smaller screens get a slide-over.
 * Returns null when no panel belongs here, so the caller can show the member list instead.
 */
export function ChannelSidePanel({ fallback }: { fallback?: ReactNode }) {
  const { serverId, channel } = useChat()
  const breakpoint = useBreakpoint()
  const panel = useUiStore((s) => s.sidePanel)
  const close = useUiStore((s) => s.closeSidePanel)
  const sheetRef = useRef<HTMLDivElement>(null)

  const scopeKey = serverId ?? channel.id
  const mine =
    panel &&
    ((panel.kind === "thread" && panel.channelId === channel.id && serverId) ||
      (panel.kind === "search" && panel.scopeKey === scopeKey))
  // Called before the early return so the hook order stays fixed; only active for the sheet.
  useSwipe(sheetRef, { onSwipeRight: close }, Boolean(mine) && breakpoint === "mobile")
  if (!mine || !panel) return <>{fallback}</>

  const content =
    panel.kind === "thread" ? (
      <ThreadPanel key={panel.threadId} serverId={serverId!} threadId={panel.threadId} onClose={close} />
    ) : (
      <SearchPanel query={panel.query} onClose={close} />
    )

  if (breakpoint === "desktop") {
    return <aside aria-label={panel.kind === "thread" ? "Thread" : "Search results"} className="w-[420px] shrink-0 border-l border-border">{content}</aside>
  }
  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent ref={sheetRef} side="right" showCloseButton={false} className="w-full max-w-full gap-0 border-0 p-0 sm:max-w-[480px]">
        <SheetTitle className="sr-only">{panel.kind === "thread" ? "Thread" : "Search"}</SheetTitle>
        {content}
      </SheetContent>
    </Sheet>
  )
}

/** The header search box. Enter opens results in the side panel. */
export function HeaderSearch({ className }: { className?: string }) {
  const { serverId, channel } = useChat()
  const openSidePanel = useUiStore((s) => s.openSidePanel)
  const panel = useUiStore((s) => s.sidePanel)
  const close = useUiStore((s) => s.closeSidePanel)
  const [value, setValue] = useState("")
  const scopeKey = serverId ?? channel.id

  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) openSidePanel({ kind: "search", scopeKey, query: value.trim() })
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setValue("")
                if (panel?.kind === "search") close()
              }
            }}
            placeholder={serverId ? "Search" : "Search DM"}
            aria-label="Search messages"
            className="h-6 w-36 rounded-sm bg-rail pr-6 pl-1.5 text-sm text-foreground transition-[width] outline-none placeholder:text-muted-foreground focus:w-60"
          />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {SEARCH_HINT}
        </TooltipContent>
      </Tooltip>
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue("")
            if (panel?.kind === "search") close()
          }}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      ) : (
        <SearchIcon className="pointer-events-none absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      )}
    </form>
  )
}
