"use client"

import type { RealtimeChannel } from "@supabase/supabase-js"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { toast } from "sonner"

import { useChannels, useMembers } from "@/lib/queries/servers"
import { playVoiceSound } from "@/lib/sound"
import { useUserId } from "@/lib/stores/auth-store"
import { useVoiceRoster, useVoiceRosterStore, useVoiceStore } from "@/lib/stores/voice-store"
import { getSupabase } from "@/lib/supabase/client"
import {
  isSpeakingEvent,
  rosterFromPresence,
  sameRoster,
  type SpeakingEvent,
  type VoicePresenceMeta,
} from "@/lib/voice/roster"

import { useVoiceAudio } from "./use-voice-audio"

/**
 * Owns every `voice:<channel>` presence topic: subscribes to the channels views are
 * watching plus the one we're connected to, keeps their rosters in the store, and
 * announces this tab in the connected channel. (realtime-js shares one object per topic,
 * so a single owner avoids two subscribers tearing down each other's channel.)
 */
function useVoicePresence() {
  const userId = useUserId()
  const connection = useVoiceStore((s) => s.connection)
  const selfMute = useVoiceStore((s) => s.selfMute)
  const selfDeaf = useVoiceStore((s) => s.selfDeaf)
  const speaking = useVoiceStore((s) => s.speaking)
  const video = useVoiceStore((s) => s.camera && Boolean(s.connection?.canVideo))
  const streaming = useVoiceStore((s) => s.screenShare && Boolean(s.connection?.canVideo))
  const watched = useVoiceRosterStore((s) => Object.keys(s.watchers).sort().join(","))

  const connectedId = connection?.channelId ?? null
  const joinedAt = connection?.joinedAt ?? null
  const topicKey = useMemo(() => {
    const ids = new Set(watched ? watched.split(",") : [])
    if (connectedId) ids.add(connectedId)
    return [...ids].sort().join(",")
  }, [watched, connectedId])

  const meta = useMemo<VoicePresenceMeta | null>(
    () =>
      joinedAt
        ? { user_id: userId, self_mute: selfMute, self_deaf: selfDeaf, joined_at: joinedAt, video, streaming }
        : null,
    [userId, selfMute, selfDeaf, joinedAt, video, streaming]
  )

  const channels = useRef(new Map<string, RealtimeChannel>())
  const subscribed = useRef(new Set<string>())
  /** Per topic: recomputes its roster from presence plus who is speaking. */
  const publishers = useRef(new Map<string, () => void>())
  /** The topic we're currently announced on, if any. */
  const announcedOn = useRef<string | null>(null)
  const latest = useRef<{ meta: VoicePresenceMeta | null; target: string | null }>({ meta: null, target: null })

  /** Brings our presence in line with `latest`: untrack the old channel, track the current one. */
  const announce = useCallback(async () => {
    const { meta, target } = latest.current
    if (announcedOn.current && announcedOn.current !== target) {
      const old = channels.current.get(announcedOn.current)
      announcedOn.current = null
      if (old) void old.untrack()
    }
    if (!meta || !target) return
    const channel = channels.current.get(target)
    // Not subscribed yet: this runs again once it is.
    if (!channel || !subscribed.current.has(target)) return
    announcedOn.current = target
    const result = await channel.track(meta)
    const { connection, setStatus, leave } = useVoiceStore.getState()
    if (connection?.channelId !== target) return
    if (result === "ok") {
      // With LiveKit the room decides when we're connected; presence-only voice is done here.
      if (connection.audio === "unavailable") setStatus("connected")
    } else if (connection.status === "connecting") {
      leave()
      toast.error("Couldn't join voice. You may not have permission to connect to this channel.")
    }
  }, [])

  useEffect(() => {
    latest.current = { meta, target: connectedId }
    void announce()
  }, [meta, connectedId, announce])

  // Tell the channel when we start or stop talking. Broadcast doesn't echo our own events,
  // so our roster entry is refreshed locally.
  const talking = speaking && !selfMute
  useEffect(() => {
    if (!connectedId) return
    publishers.current.get(connectedId)?.()
    const channel = channels.current.get(connectedId)
    if (!channel || !subscribed.current.has(connectedId)) return
    void channel.send({
      type: "broadcast",
      event: "speaking",
      payload: { user_id: userId, speaking: talking } satisfies SpeakingEvent,
    })
  }, [talking, connectedId, userId])

  // Subscribe to newly needed topics and drop the ones nobody needs any more.
  useEffect(() => {
    const supabase = getSupabase()
    const { setRoster, clearRoster } = useVoiceRosterStore.getState()
    const wanted = new Set(topicKey ? topicKey.split(",") : [])
    let cancelled = false

    for (const [id, channel] of channels.current) {
      if (wanted.has(id)) continue
      channels.current.delete(id)
      subscribed.current.delete(id)
      if (announcedOn.current === id) announcedOn.current = null
      publishers.current.delete(id)
      void supabase.removeChannel(channel)
      clearRoster(id)
    }

    const added = [...wanted].filter((id) => !channels.current.has(id))
    if (added.length > 0) {
      void supabase.realtime.setAuth().then(() => {
        if (cancelled) return
        for (const id of added) {
          if (channels.current.has(id)) continue
          // A unique key per connection: when two of a user's tabs share a key, one leaving
          // drops the other from everyone's view too. Rosters group by user_id instead.
          const channel = supabase.channel(`voice:${id}`, {
            config: { private: true, presence: { key: crypto.randomUUID() } },
          })
          channels.current.set(id, channel)

          const speakers: Record<string, boolean> = {}
          const publish = () => {
            const state = channel.presenceState<VoicePresenceMeta>() as unknown as Record<string, VoicePresenceMeta[]>
            const present = new Set(Object.values(state).flatMap((metas) => metas.map((m) => m.user_id)))
            // Someone who left mid-sentence stops "speaking".
            for (const speaker of Object.keys(speakers)) if (!present.has(speaker)) delete speakers[speaker]
            const voice = useVoiceStore.getState()
            const self = voice.connection?.channelId === id && voice.speaking && !voice.selfMute
            const roster = rosterFromPresence(state, { ...speakers, [userId]: self })
            if (!sameRoster(useVoiceRosterStore.getState().rosters[id], roster)) setRoster(id, roster)
          }
          publishers.current.set(id, publish)

          channel
            .on("presence", { event: "sync" }, publish)
            .on("broadcast", { event: "speaking" }, ({ payload }) => {
              if (!isSpeakingEvent(payload) || payload.user_id === userId) return
              if (payload.speaking) speakers[payload.user_id] = true
              else delete speakers[payload.user_id]
              publish()
            })
            .subscribe((status) => {
              const { connection, setStatus } = useVoiceStore.getState()
              if (status === "SUBSCRIBED") {
                subscribed.current.add(id)
                if (announcedOn.current === id) announcedOn.current = null
                void announce()
              } else {
                subscribed.current.delete(id)
                if (connection?.channelId === id && connection.status === "connected") setStatus("reconnecting")
              }
            })
        }
      })
    }
    return () => {
      cancelled = true
    }
  }, [topicKey, userId, announce])

  // Leave every topic when the app unmounts (sign-out).
  useEffect(() => {
    const map = channels.current
    const ready = subscribed.current
    const publishersMap = publishers.current
    return () => {
      const supabase = getSupabase()
      const { clearRoster } = useVoiceRosterStore.getState()
      for (const [id, channel] of map) {
        void supabase.removeChannel(channel)
        clearRoster(id)
      }
      map.clear()
      ready.clear()
      publishersMap.clear()
    }
  }, [])
}

/** Leaves voice when the channel disappears or the user is timed out in that server. */
function useVoiceGuards() {
  const userId = useUserId()
  const connection = useVoiceStore((s) => s.connection)
  const leave = useVoiceStore((s) => s.leave)
  const { data: channels } = useChannels(connection?.serverId)
  const { data: members } = useMembers(connection?.serverId)

  const channelGone = Boolean(connection && channels && !channels.some((c) => c.id === connection.channelId))
  const timeoutUntil = members?.find((m) => m.user_id === userId)?.timeout_until ?? null

  useEffect(() => {
    if (!channelGone) return
    leave()
    toast("The voice channel you were in is no longer available.")
  }, [channelGone, leave])

  useEffect(() => {
    if (!connection || !timeoutUntil || new Date(timeoutUntil).getTime() <= Date.now()) return
    leave()
    toast("You've been timed out, so you were disconnected from voice.")
  }, [connection, timeoutUntil, leave])
}

/** Join and leave chimes for you and for others in your channel (silent while deafened). */
function useVoiceSounds() {
  const userId = useUserId()
  const connection = useVoiceStore((s) => s.connection)
  const selfDeaf = useVoiceStore((s) => s.selfDeaf)
  const roster = useVoiceRoster(connection?.channelId ?? "")
  const connected = connection?.status === "connected"
  const channelId = connection?.channelId ?? null

  // You: chime once connected, and again when you leave.
  const wasIn = useRef<string | null>(null)
  useEffect(() => {
    if (connected && channelId && wasIn.current !== channelId) {
      if (!selfDeaf) playVoiceSound("join")
      wasIn.current = channelId
    } else if (!channelId && wasIn.current) {
      if (!selfDeaf) playVoiceSound("leave")
      wasIn.current = null
    }
  }, [connected, channelId, selfDeaf])

  // Others: compare with the previous roster; the first one after joining is the baseline.
  const previous = useRef<{ channelId: string; ids: Set<string> } | null>(null)
  useEffect(() => {
    if (!connected || !channelId) {
      previous.current = null
      return
    }
    const ids = new Set(roster.map((m) => m.userId).filter((id) => id !== userId))
    const before = previous.current?.channelId === channelId ? previous.current.ids : null
    previous.current = { channelId, ids }
    if (!before || selfDeaf) return
    if ([...ids].some((id) => !before.has(id))) playVoiceSound("join")
    else if ([...before].some((id) => !ids.has(id))) playVoiceSound("leave")
  }, [roster, connected, channelId, userId, selfDeaf])
}

/** Voice presence, audio, guards and sounds for the signed-in app. Renders nothing. */
export function VoiceSync() {
  useVoicePresence()
  useVoiceAudio()
  useVoiceGuards()
  useVoiceSounds()
  return null
}
