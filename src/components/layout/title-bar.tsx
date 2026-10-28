"use client"

import { CircleHelpIcon } from "lucide-react"
import { useParams, usePathname } from "next/navigation"

import { KtcordMark } from "@/components/brand/logo"
import { ServerIcon } from "@/components/servers/server-icon"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useServer } from "@/lib/queries/servers"
import { useUiStore } from "@/lib/stores/ui-store"

/** The thin bar across the top in Discord's newer look: where you are, and help. */
export function TitleBar() {
  const params = useParams<{ serverId?: string }>()
  const pathname = usePathname()
  const { data: server } = useServer(params.serverId)
  const openDialog = useUiStore((s) => s.openDialog)
  const friends = pathname === "/channels/me"

  return (
    <header className="relative flex h-9 shrink-0 items-center justify-center px-3 text-sm font-semibold text-header">
      <span className="flex min-w-0 items-center gap-2">
        {server ? (
          <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary text-[9px] text-white">
            <ServerIcon name={server.name} iconUrl={server.icon_url} className="text-[9px]" />
          </span>
        ) : (
          <KtcordMark className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{server ? server.name : friends ? "Friends" : "Direct Messages"}</span>
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Keyboard shortcuts"
            onClick={() => openDialog({ kind: "shortcuts" })}
            className="absolute right-3 flex size-6 items-center justify-center rounded-md text-interactive hover:text-interactive-hover"
          >
            <CircleHelpIcon className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Keyboard shortcuts</TooltipContent>
      </Tooltip>
    </header>
  )
}
