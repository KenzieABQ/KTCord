"use client"

import { HeadphoneOffIcon, HeadphonesIcon, MicIcon, MicOffIcon, PhoneOffIcon, Volume2Icon } from "lucide-react"

import { UserAvatar } from "@/components/profile/user-avatar"
import { UserPopover } from "@/components/profile/user-popover"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Channel } from "@/lib/api/channels"
import { memberDisplayName } from "@/lib/members"
import { useMembers } from "@/lib/queries/servers"
import { useVoiceRoster, useVoiceStore, useWatchVoiceChannels } from "@/lib/stores/voice-store"
import { cn } from "@/lib/utils"
import type { VoiceMember } from "@/lib/voice/roster"

import { useJoinVoice } from "./use-join-voice"
import { VoiceStateIcons } from "./voice-occupants"

function Tile({ serverId, person }: { serverId: string; person: VoiceMember }) {
  const { data: members } = useMembers(serverId)
  const member = members?.find((m) => m.user_id === person.userId)
  const name = member ? memberDisplayName(member) : "Someone"
  return (
    <UserPopover userId={person.userId} serverId={serverId} side="top">
      <button
        type="button"
        aria-label={`${name}${person.speaking ? ", speaking" : ""}${person.selfMute ? ", muted" : ""}${person.selfDeaf ? ", deafened" : ""}`}
        className={cn(
          "relative flex aspect-video min-w-0 items-center justify-center rounded-lg bg-sidebar ring-2 ring-transparent transition-shadow hover:bg-item-hover",
          person.speaking && "ring-status-online"
        )}
      >
        <UserAvatar userId={person.userId} name={name} src={member?.profile.avatar_url} className="size-20 text-2xl" />
        <span className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-md bg-black/55 px-2 py-0.5 text-sm font-medium text-white">
          <span className="truncate">{name}</span>
          <VoiceStateIcons member={person} className="text-white/80" />
        </span>
      </button>
    </UserPopover>
  )
}

function ControlButton({
  label,
  onClick,
  active,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={danger ? undefined : Boolean(active)}
          onClick={onClick}
          className={cn(
            "flex size-12 items-center justify-center rounded-full transition-colors",
            danger
              ? "bg-destructive text-white hover:bg-destructive/80"
              : active
                ? "bg-white text-black hover:bg-white/90"
                : "bg-sidebar text-header hover:bg-item-hover"
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

/** The body of a voice channel: everyone connected, and the call controls. */
export function VoiceChannelView({ serverId, channel }: { serverId: string; channel: Channel }) {
  useWatchVoiceChannels([channel.id])
  const roster = useVoiceRoster(channel.id)
  const { connection, selfMute, selfDeaf, toggleMute, toggleDeaf, leave } = useVoiceStore()
  const { ready, canConnect, join } = useJoinVoice(serverId)
  const here = connection?.channelId === channel.id

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-rail">
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
        {roster.length > 0 ? (
          <ul
            aria-label={`Connected to ${channel.name}`}
            className="mx-auto grid max-w-5xl grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3"
          >
            {roster.map((person) => (
              <li key={person.userId} className="grid">
                <Tile serverId={serverId} person={person} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="flex size-20 items-center justify-center rounded-full bg-sidebar">
              <Volume2Icon className="size-10 text-muted-foreground" />
            </span>
            <h2 className="text-2xl font-bold text-header">{channel.name}</h2>
            <p className="max-w-sm text-muted-foreground">No one is here yet. Hop in and others will see you&apos;re around.</p>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-center gap-3 px-4 pt-2 pb-5">
        {here ? (
          <>
            <ControlButton label={selfMute ? "Unmute" : "Mute"} active={selfMute} onClick={toggleMute}>
              {selfMute ? <MicOffIcon className="size-5" /> : <MicIcon className="size-5" />}
            </ControlButton>
            <ControlButton label={selfDeaf ? "Undeafen" : "Deafen"} active={selfDeaf} onClick={toggleDeaf}>
              {selfDeaf ? <HeadphoneOffIcon className="size-5" /> : <HeadphonesIcon className="size-5" />}
            </ControlButton>
            <ControlButton label="Disconnect" danger onClick={leave}>
              <PhoneOffIcon className="size-5" />
            </ControlButton>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Button
              size="lg"
              className="min-w-40 bg-status-online text-white hover:bg-status-online/85"
              disabled={!canConnect}
              onClick={() => join(channel.id)}
            >
              {connection ? "Switch to This Channel" : "Join Voice"}
            </Button>
            {ready && !canConnect && (
              <p className="text-sm text-muted-foreground">You don&apos;t have permission to connect here right now.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
