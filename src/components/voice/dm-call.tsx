"use client"

import { useEffect, useRef } from "react"
import { useShallow } from "zustand/react/shallow"

import { HeaderButton } from "@/components/chat/header-button"
import { PhoneIcon, VideoIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { dmTitle, type DmChannel } from "@/lib/api/dms"
import { useVisibleDms } from "@/lib/queries/social"
import { playNotificationSound } from "@/lib/sound"
import { useUserId } from "@/lib/stores/auth-store"
import { usePrefsStore } from "@/lib/stores/prefs-store"
import { useVoiceMediaStore } from "@/lib/stores/voice-media-store"
import { useVoiceRosterStore, useVoiceStore, useWatchVoiceChannels } from "@/lib/stores/voice-store"
import { toast } from "@/lib/toast"

import { useVoicePeople } from "./use-voice-people"
import { CallControls, CallStage } from "./voice-channel-view"

/** Joins a DM's call (a DM call has no server); `video` turns the camera on too. */
export function startDmCall(dmId: string, video = false) {
  const voice = useVoiceStore.getState()
  voice.join(null, dmId)
  if (video) voice.setCamera(true)
}

/** Voice and video call buttons for a DM's header. Hidden while you're already in its call. */
export function DmCallButtons({ dm }: { dm: DmChannel }) {
  const inCall = useVoiceStore((s) => s.connection?.channelId === dm.id)
  if (inCall) return null
  return (
    <>
      <HeaderButton label="Start Voice Call" onClick={() => startDmCall(dm.id)}>
        <PhoneIcon className="size-5" />
      </HeaderButton>
      <HeaderButton label="Start Video Call" onClick={() => startDmCall(dm.id, true)}>
        <VideoIcon className="size-5" />
      </HeaderButton>
    </>
  )
}

/**
 * The call area above a DM's messages while a call is going, as in Discord: everyone in it,
 * and your controls (or Join buttons if you're not in it yet).
 */
export function DmCallPanel({ dm }: { dm: DmChannel }) {
  useWatchVoiceChannels([dm.id])
  const roster = useVoicePeople(null, dm.id)
  const here = useVoiceStore((s) => (s.connection?.channelId === dm.id ? s.connection : null))
  const sharing = useVoiceMediaStore(
    useShallow((s) => (here ? Object.keys(s.videos).filter((id) => s.videos[id].screen) : []))
  )
  if (roster.length === 0 && !here) return null

  return (
    <div className="flex h-[min(46vh,440px)] shrink-0 flex-col border-b border-border bg-rail">
      {here?.audio === "unavailable" && (
        <p role="note" className="shrink-0 bg-status-idle/15 px-4 py-1.5 text-center text-xs text-header">
          Audio is off: no voice server is set up for this KTCord yet.
        </p>
      )}
      {roster.length > 0 ? (
        <CallStage serverId={null} channelName={dm.name ?? "Call"} roster={roster} sharing={sharing} />
      ) : (
        <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Calling…</p>
      )}
      <div className="flex shrink-0 justify-center gap-3 px-4 pb-4">
        {here ? (
          <CallControls />
        ) : (
          <>
            <Button className="bg-status-online text-white hover:bg-status-online/85" onClick={() => startDmCall(dm.id)}>
              <PhoneIcon /> Join Call
            </Button>
            <Button variant="secondary" onClick={() => startDmCall(dm.id, true)}>
              <VideoIcon /> Join with Video
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Rings when someone starts a call in one of your DMs (and you're not in it): a card with
 * Join and Decline. Watches your most recent conversations' calls.
 */
export function IncomingCalls() {
  const userId = useUserId()
  const { data: dms } = useVisibleDms()
  const recent = (dms ?? []).slice(0, 25)
  useWatchVoiceChannels(recent.map((d) => d.id))
  const active = useVoiceRosterStore(
    useShallow((s) => recent.filter((d) => (s.rosters[d.id]?.length ?? 0) > 0).map((d) => d.id))
  )
  const connected = useVoiceStore((s) => s.connection?.channelId ?? null)
  const rung = useRef(new Set<string>())

  useEffect(() => {
    // Calls that ended can ring again next time.
    for (const id of [...rung.current]) if (!active.includes(id)) rung.current.delete(id)
    for (const id of active) {
      if (rung.current.has(id) || id === connected) continue
      const dm = dms?.find((d) => d.id === id)
      const roster = useVoiceRosterStore.getState().rosters[id] ?? []
      if (!dm || roster.some((p) => p.userId === userId)) continue
      rung.current.add(id)
      const caller = dm.recipients.find((r) => r.user_id === roster[0]?.userId)
      if (usePrefsStore.getState().notificationSound) playNotificationSound()
      toast.call({
        callerId: caller?.user_id ?? id,
        caller: caller ? caller.profile.display_name || caller.profile.username : dmTitle(dm, userId),
        avatarUrl: caller?.profile.avatar_url ?? null,
        place: dm.type === "group_dm" ? dmTitle(dm, userId) : "Incoming call",
        onJoin: () => startDmCall(id),
      })
    }
  }, [active, connected, dms, userId])

  return null
}
