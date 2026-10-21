"use client"

import { PhoneOffIcon, SignalIcon } from "lucide-react"
import Link from "next/link"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useChannels, useServer } from "@/lib/queries/servers"
import { useVoiceStore, type VoiceStatus } from "@/lib/stores/voice-store"
import { cn } from "@/lib/utils"

const STATUS: Record<VoiceStatus, { label: string; className: string }> = {
  connecting: { label: "Connecting…", className: "text-status-idle" },
  connected: { label: "Voice Connected", className: "text-status-online" },
  reconnecting: { label: "Reconnecting…", className: "text-status-idle" },
}

/** Above the user panel while connected to voice: status, where, and a disconnect button. */
export function VoicePanel() {
  const connection = useVoiceStore((s) => s.connection)
  const leave = useVoiceStore((s) => s.leave)
  const { data: server } = useServer(connection?.serverId)
  const { data: channels } = useChannels(connection?.serverId)
  if (!connection) return null

  const channel = channels?.find((c) => c.id === connection.channelId)
  const status = STATUS[connection.status]

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-card/80 px-2 py-1.5 dark:bg-[#232428]">
      <div className="min-w-0 flex-1 pl-1">
        <p role="status" className={cn("flex items-center gap-1.5 text-sm font-semibold", status.className)}>
          <SignalIcon className="size-4" />
          {status.label}
        </p>
        <Link
          href={`/channels/${connection.serverId}/${connection.channelId}`}
          className="block truncate text-xs text-muted-foreground hover:text-interactive-hover hover:underline"
        >
          {channel?.name ?? "Voice"} / {server?.name ?? "Server"}
        </Link>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Disconnect"
            onClick={leave}
            className="flex size-8 items-center justify-center rounded-md text-interactive hover:bg-item-hover hover:text-interactive-hover"
          >
            <PhoneOffIcon className="size-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Disconnect</TooltipContent>
      </Tooltip>
    </div>
  )
}
