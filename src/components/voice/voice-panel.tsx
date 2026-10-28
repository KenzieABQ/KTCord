"use client"

import { MonitorUpIcon, PhoneOffIcon, SignalIcon, VideoIcon } from "@/components/icons"
import type { ReactNode } from "react"
import Link from "next/link"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { dmTitle } from "@/lib/api/dms"
import { useChannels, useServer } from "@/lib/queries/servers"
import { useVisibleDms } from "@/lib/queries/social"
import { useUserId } from "@/lib/stores/auth-store"
import { usePrefsStore } from "@/lib/stores/prefs-store"
import { useVoiceStore, type VoiceStatus } from "@/lib/stores/voice-store"
import { cn } from "@/lib/utils"
import { formatKeyCode } from "@/lib/voice/keys"

import { useMyVoiceModeration } from "./use-my-voice-moderation"

const STATUS: Record<VoiceStatus, { label: string; className: string }> = {
  connecting: { label: "Connecting…", className: "text-status-idle" },
  connected: { label: "Voice Connected", className: "text-status-online" },
  reconnecting: { label: "Reconnecting…", className: "text-status-idle" },
}

function PanelButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
          className={cn(
            "flex size-8 items-center justify-center rounded-md hover:bg-item-hover",
            active ? "text-status-online" : "text-interactive hover:text-interactive-hover"
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

/** Above the user panel while connected to voice: status, where, camera/screen, and disconnect. */
export function VoicePanel() {
  const connection = useVoiceStore((s) => s.connection)
  const leave = useVoiceStore((s) => s.leave)
  const camera = useVoiceStore((s) => s.camera)
  const screenShare = useVoiceStore((s) => s.screenShare)
  const pushToTalkHeld = useVoiceStore((s) => s.pushToTalkHeld)
  const inputMode = usePrefsStore((s) => s.inputMode)
  const pushToTalkKey = usePrefsStore((s) => s.pushToTalkKey)
  const { serverMute, serverDeaf } = useMyVoiceModeration()
  const { data: server } = useServer(connection?.serverId ?? undefined)
  const { data: channels } = useChannels(connection?.serverId ?? undefined)
  const userId = useUserId()
  const { data: dms } = useVisibleDms()
  if (!connection) return null

  const channel = channels?.find((c) => c.id === connection.channelId)
  const dm = connection.serverId ? undefined : dms?.find((d) => d.id === connection.channelId)
  // A DM call links back to the conversation; a voice channel to the channel in its server.
  const where = connection.serverId
    ? { href: `/channels/${connection.serverId}/${connection.channelId}`, label: `${channel?.name ?? "Voice"} / ${server?.name ?? "Server"}` }
    : { href: `/channels/me/${connection.channelId}`, label: dm ? dmTitle(dm, userId) : "Direct Message" }
  const status = STATUS[connection.status]

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5">
      <div className="min-w-0 flex-1 pl-1">
        <p role="status" className={cn("flex items-center gap-1.5 text-sm font-semibold", status.className)}>
          <SignalIcon className="size-4" />
          {status.label}
        </p>
        <Link
          href={where.href}
          className="block truncate text-xs text-muted-foreground hover:text-interactive-hover hover:underline"
        >
          {where.label}
        </Link>
        {serverMute || serverDeaf ? (
          <p className="truncate text-[11px] text-destructive">
            {serverMute && serverDeaf ? "Server muted and deafened" : serverMute ? "Server muted" : "Server deafened"} by a moderator
          </p>
        ) : connection.audio === "unavailable" ? (
          <p className="truncate text-[11px] text-muted-foreground">Presence only: no voice server set up</p>
        ) : !connection.canSpeak ? (
          <p className="truncate text-[11px] text-muted-foreground">Listening only</p>
        ) : inputMode === "push-to-talk" && connection.audio === "livekit" ? (
          <p className="truncate text-[11px] text-muted-foreground">
            {pushToTalkHeld ? "Talking…" : `Hold ${formatKeyCode(pushToTalkKey)} to talk`}
          </p>
        ) : null}
      </div>
      {connection.audio === "livekit" && connection.canVideo && (
        <>
          <PanelButton
            label={camera ? "Turn Off Camera" : "Turn On Camera"}
            active={camera}
            onClick={() => useVoiceStore.getState().setCamera(!camera)}
          >
            <VideoIcon className="size-5" />
          </PanelButton>
          {typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia) && (
            <PanelButton
              label={screenShare ? "Stop Sharing" : "Share Your Screen"}
              active={screenShare}
              onClick={() => useVoiceStore.getState().setScreenShare(!screenShare)}
            >
              <MonitorUpIcon className="size-5" />
            </PanelButton>
          )}
        </>
      )}
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
