"use client"

import {
  HeadphoneOffIcon,
  HeadphonesIcon,
  MaximizeIcon,
  MicIcon,
  MicOffIcon,
  MonitorOffIcon,
  MonitorUpIcon,
  PhoneOffIcon,
  VideoIcon,
  VideoOffIcon,
  Volume2Icon,
} from "lucide-react"
import { useRef } from "react"
import { useShallow } from "zustand/react/shallow"

import { UserAvatar } from "@/components/profile/user-avatar"
import { UserPopover } from "@/components/profile/user-popover"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Channel } from "@/lib/api/channels"
import { memberDisplayName } from "@/lib/members"
import { useMembers } from "@/lib/queries/servers"
import { useUserId } from "@/lib/stores/auth-store"
import { useVideo, useVoiceMediaStore } from "@/lib/stores/voice-media-store"
import { useVoiceStore, useWatchVoiceChannels } from "@/lib/stores/voice-store"
import { cn } from "@/lib/utils"
import type { VoiceMember } from "@/lib/voice/roster"

import { useJoinVoice } from "./use-join-voice"
import { useVoicePeople } from "./use-voice-people"
import { VideoTrack } from "./video-track"
import { VoiceMemberMenu } from "./voice-member-menu"
import { VoiceStateIcons } from "./voice-occupants"

function useMemberName(serverId: string, userId: string) {
  const { data: members } = useMembers(serverId)
  const member = members?.find((m) => m.user_id === userId)
  return { member, name: member ? memberDisplayName(member) : "Someone" }
}

/** Someone's shared screen, wide, with a fullscreen button. */
function ScreenTile({ serverId, userId }: { serverId: string; userId: string }) {
  const track = useVideo(userId, "screen")
  const { name } = useMemberName(serverId, userId)
  const ref = useRef<HTMLDivElement>(null)
  if (!track) return null
  return (
    <div ref={ref} className="group/screen relative col-span-full aspect-video overflow-hidden rounded-lg bg-black">
      <VideoTrack track={track} className="object-contain" />
      <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-0.5 text-sm font-medium text-white">
        <span className="rounded-sm bg-destructive px-1 text-[10px] font-bold">LIVE</span>
        {name}&apos;s screen
      </span>
      <button
        type="button"
        aria-label="Full screen"
        onClick={() => void ref.current?.requestFullscreen()}
        className="absolute right-2 bottom-2 flex size-8 items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition-opacity group-hover/screen:opacity-100 focus-visible:opacity-100"
      >
        <MaximizeIcon className="size-4" />
      </button>
    </div>
  )
}

function Tile({ serverId, person }: { serverId: string; person: VoiceMember }) {
  const userId = useUserId()
  const { member, name } = useMemberName(serverId, person.userId)
  const camera = useVideo(person.userId, "camera")
  return (
    <VoiceMemberMenu serverId={serverId} person={person}>
      <UserPopover userId={person.userId} serverId={serverId} side="top">
        <button
          type="button"
          aria-label={`${name}${person.speaking ? ", speaking" : ""}${person.serverMute ? ", server muted" : person.selfMute ? ", muted" : ""}${person.serverDeaf ? ", server deafened" : person.selfDeaf ? ", deafened" : ""}`}
          className={cn(
            "relative flex aspect-video min-w-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar ring-2 ring-transparent transition-shadow hover:bg-item-hover",
            person.speaking && "ring-status-online"
          )}
        >
          {camera ? (
            <VideoTrack track={camera} mirror={person.userId === userId} className="object-cover" />
          ) : (
            <UserAvatar userId={person.userId} name={name} src={member?.profile.avatar_url} className="size-20 text-2xl" />
          )}
          <span className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-md bg-black/55 px-2 py-0.5 text-sm font-medium text-white">
            <span className="truncate">{name}</span>
            <VoiceStateIcons member={person} className="text-white/80" />
          </span>
        </button>
      </UserPopover>
    </VoiceMemberMenu>
  )
}

function ControlButton({
  label,
  onClick,
  active,
  danger,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  danger?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={danger ? undefined : Boolean(active)}
          aria-disabled={disabled || undefined}
          onClick={disabled ? undefined : onClick}
          className={cn(
            "flex size-12 items-center justify-center rounded-full transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
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
  const roster = useVoicePeople(serverId, channel.id)
  const { connection, selfMute, selfDeaf, toggleMute, toggleDeaf, leave, camera, screenShare, setCamera, setScreenShare } =
    useVoiceStore()
  const { ready, canConnect: canConnectTo, join } = useJoinVoice(serverId)
  const canConnect = canConnectTo(channel.id)
  const here = connection?.channelId === channel.id ? connection : null
  // Video only flows in the room you're connected to.
  const sharing = useVoiceMediaStore(
    useShallow((s) => (here ? Object.keys(s.videos).filter((id) => s.videos[id].screen) : []))
  )
  const videoBlocked =
    here?.audio !== "livekit"
      ? "Video needs a voice server"
      : !here.canVideo
        ? "You don't have permission to share video here"
        : null
  const canShareScreen = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-rail">
      {here?.audio === "unavailable" && (
        <p role="note" className="shrink-0 bg-status-idle/15 px-4 py-2 text-center text-sm text-header">
          Audio is off: no voice server is set up for this KTCord yet. You can still see who&apos;s here.
        </p>
      )}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
        {roster.length > 0 ? (
          <ul
            aria-label={`Connected to ${channel.name}`}
            className="mx-auto grid max-w-5xl grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3"
          >
            {sharing.map((id) => (
              <li key={`screen-${id}`} className="col-span-full grid">
                <ScreenTile serverId={serverId} userId={id} />
              </li>
            ))}
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
            <ControlButton
              label={
                here.canSpeak === false
                  ? "You don't have permission to speak here"
                  : selfMute
                    ? "Unmute"
                    : "Mute"
              }
              active={selfMute || here.canSpeak === false}
              disabled={here.canSpeak === false}
              onClick={toggleMute}
            >
              {selfMute || here.canSpeak === false ? (
                <MicOffIcon className="size-5" />
              ) : (
                <MicIcon className="size-5" />
              )}
            </ControlButton>
            <ControlButton label={selfDeaf ? "Undeafen" : "Deafen"} active={selfDeaf} onClick={toggleDeaf}>
              {selfDeaf ? <HeadphoneOffIcon className="size-5" /> : <HeadphonesIcon className="size-5" />}
            </ControlButton>
            <ControlButton
              label={videoBlocked ?? (camera ? "Turn Off Camera" : "Turn On Camera")}
              active={camera}
              disabled={Boolean(videoBlocked)}
              onClick={() => setCamera(!camera)}
            >
              {camera ? <VideoIcon className="size-5" /> : <VideoOffIcon className="size-5" />}
            </ControlButton>
            {canShareScreen && (
              <ControlButton
                label={videoBlocked ?? (screenShare ? "Stop Sharing" : "Share Your Screen")}
                active={screenShare}
                disabled={Boolean(videoBlocked)}
                onClick={() => setScreenShare(!screenShare)}
              >
                {screenShare ? <MonitorOffIcon className="size-5" /> : <MonitorUpIcon className="size-5" />}
              </ControlButton>
            )}
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
