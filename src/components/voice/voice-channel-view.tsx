"use client"

import {
  HeadphoneOffIcon,
  HeadphonesIcon,
  MaximizeIcon,
  MicIcon,
  MicOffIcon,
  MonitorOffIcon,
  MonitorUpIcon,
  LayoutGridIcon,
  PhoneOffIcon,
  PinIcon,
  PinOffIcon,
  RectangleHorizontalIcon,
  VideoIcon,
  VideoOffIcon,
  Volume2Icon,
} from "@/components/icons"
import { useRef, useState } from "react"
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
function ScreenTile({ serverId, userId, className }: { serverId: string; userId: string; className?: string }) {
  const track = useVideo(userId, "screen")
  const { name } = useMemberName(serverId, userId)
  const ref = useRef<HTMLDivElement>(null)
  if (!track) return null
  return (
    <div ref={ref} className={cn("group/screen relative size-full overflow-hidden rounded-lg bg-black", className)}>
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

function Tile({
  serverId,
  person,
  compact,
  className,
}: {
  serverId: string
  person: VoiceMember
  compact?: boolean
  className?: string
}) {
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
            "relative flex size-full min-w-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar hover:bg-item-hover",
            className
          )}
        >
          {/* The speaking outline sits inside, above the video, so nothing covers or clips it. */}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 z-10 rounded-lg ring-[3px] ring-inset transition-colors",
              person.speaking ? "ring-status-online" : "ring-transparent"
            )}
          />
          {camera ? (
            <VideoTrack track={camera} mirror={person.userId === userId} className="object-cover" />
          ) : (
            <UserAvatar
              userId={person.userId}
              name={name}
              src={member?.profile.avatar_url}
              className={compact ? "size-12 text-base" : "size-20 text-2xl"}
            />
          )}
          <span
            className={cn(
              "absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-md bg-black/55 px-2 py-0.5 font-medium text-white",
              compact ? "text-xs" : "text-sm"
            )}
          >
            <span className="truncate">{name}</span>
            <VoiceStateIcons member={person} className="text-white/80" />
          </span>
        </button>
      </UserPopover>
    </VoiceMemberMenu>
  )
}

/** One thing on the call stage: a person (camera or avatar) or someone's shared screen. */
type Feed = { key: string; kind: "user"; person: VoiceMember } | { key: string; kind: "screen"; userId: string }

/** A feed with a hover pin button; double-click pins too. */
function FeedTile({
  serverId,
  feed,
  pinned,
  onPin,
  compact,
  className,
}: {
  serverId: string
  feed: Feed
  pinned: boolean
  onPin: () => void
  compact?: boolean
  className?: string
}) {
  return (
    <div className={cn("group/tile relative min-w-0", className)} onDoubleClick={onPin}>
      {feed.kind === "screen" ? (
        <ScreenTile serverId={serverId} userId={feed.userId} />
      ) : (
        <Tile serverId={serverId} person={feed.person} compact={compact} />
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={pinned ? "Unpin" : "Pin"}
            aria-pressed={pinned}
            onClick={onPin}
            className={cn(
              "absolute top-2 right-2 z-10 flex size-8 items-center justify-center rounded-md bg-black/60 text-white transition-opacity hover:bg-black/80 focus-visible:opacity-100",
              pinned ? "opacity-100" : "opacity-0 group-hover/tile:opacity-100"
            )}
          >
            {pinned ? <PinOffIcon className="size-4" /> : <PinIcon className="size-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{pinned ? "Unpin" : "Pin"}</TooltipContent>
      </Tooltip>
    </div>
  )
}

function LayoutSwitch({
  layout,
  onChange,
}: {
  layout: "grid" | "speaker"
  onChange: (layout: "grid" | "speaker") => void
}) {
  const options = [
    { value: "grid" as const, label: "Grid", icon: LayoutGridIcon },
    { value: "speaker" as const, label: "Speaker", icon: RectangleHorizontalIcon },
  ]
  return (
    <div role="radiogroup" aria-label="Layout" className="flex rounded-lg bg-sidebar p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={layout === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold",
            layout === o.value ? "bg-item-selected text-header" : "text-muted-foreground hover:text-interactive-hover"
          )}
        >
          <o.icon className="size-3.5" /> {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * The call stage. Grid shows everyone equally (screen shares full width); Speaker puts one
 * feed on the main stage (the pinned one, else a screen share, else whoever spoke last)
 * with the rest in a strip below.
 */
function CallStage({
  serverId,
  channelName,
  roster,
  sharing,
}: {
  serverId: string
  channelName: string
  roster: VoiceMember[]
  sharing: string[]
}) {
  const [layout, setLayout] = useState<"grid" | "speaker">("grid")
  const [pinnedKey, setPinnedKey] = useState<string | null>(null)
  const [lastSpeaker, setLastSpeaker] = useState<string | null>(null)
  const speaking = roster.find((p) => p.speaking)?.userId ?? null
  if (speaking && speaking !== lastSpeaker) setLastSpeaker(speaking)

  const feeds: Feed[] = [
    ...sharing.map((userId) => ({ key: `screen:${userId}`, kind: "screen" as const, userId })),
    ...roster.map((person) => ({ key: `user:${person.userId}`, kind: "user" as const, person })),
  ]
  const pinned = feeds.find((f) => f.key === pinnedKey) ?? null
  const togglePin = (key: string) => {
    if (pinnedKey === key) setPinnedKey(null)
    else {
      setPinnedKey(key)
      setLayout("speaker")
    }
  }
  const main =
    layout === "speaker"
      ? (pinned ??
        feeds.find((f) => f.kind === "screen") ??
        feeds.find((f) => f.key === `user:${lastSpeaker}`) ??
        feeds[0])
      : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      {feeds.length > 1 && (
        <div className="flex shrink-0 justify-end">
          <LayoutSwitch layout={layout} onChange={setLayout} />
        </div>
      )}
      {main ? (
        <>
          <FeedTile
            serverId={serverId}
            feed={main}
            pinned={main.key === pinnedKey}
            onPin={() => togglePin(main.key)}
            className="min-h-0 flex-1"
          />
          {feeds.length > 1 && (
            <ul aria-label="Everyone else" className="scrollbar-thin flex shrink-0 gap-2 overflow-x-auto pb-1">
              {feeds
                .filter((f) => f.key !== main.key)
                .map((feed) => (
                  <li key={feed.key} className="aspect-video w-44 shrink-0">
                    <FeedTile
                      serverId={serverId}
                      feed={feed}
                      compact
                      pinned={feed.key === pinnedKey}
                      onPin={() => togglePin(feed.key)}
                      className="size-full"
                    />
                  </li>
                ))}
            </ul>
          )}
        </>
      ) : (
        <ul
          aria-label={`Connected to ${channelName}`}
          className="scrollbar-thin mx-auto grid w-full max-w-5xl grid-cols-[repeat(auto-fill,minmax(220px,1fr))] content-start gap-3 overflow-y-auto"
        >
          {feeds.map((feed) => (
            <li key={feed.key} className={cn("aspect-video", feed.kind === "screen" && "col-span-full")}>
              <FeedTile
                serverId={serverId}
                feed={feed}
                pinned={feed.key === pinnedKey}
                onPin={() => togglePin(feed.key)}
                className="size-full"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
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
  const {
    connection,
    selfMute,
    selfDeaf,
    toggleMute,
    toggleDeaf,
    leave,
    camera,
    screenShare,
    setCamera,
    setScreenShare,
  } = useVoiceStore()
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
      <div className="flex min-h-0 flex-1 flex-col">
        {roster.length > 0 ? (
          <CallStage serverId={serverId} channelName={channel.name ?? ""} roster={roster} sharing={sharing} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
            <span className="flex size-20 items-center justify-center rounded-full bg-sidebar">
              <Volume2Icon className="size-10 text-muted-foreground" />
            </span>
            <h2 className="text-2xl font-bold text-header">{channel.name}</h2>
            <p className="max-w-sm text-muted-foreground">
              No one is here yet. Hop in and others will see you&apos;re around.
            </p>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-center gap-3 px-4 pt-2 pb-5">
        {here ? (
          <>
            <ControlButton
              label={here.canSpeak === false ? "You don't have permission to speak here" : selfMute ? "Unmute" : "Mute"}
              active={selfMute || here.canSpeak === false}
              disabled={here.canSpeak === false}
              onClick={toggleMute}
            >
              {selfMute || here.canSpeak === false ? <MicOffIcon className="size-5" /> : <MicIcon className="size-5" />}
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
