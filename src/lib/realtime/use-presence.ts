"use client"

import type { RealtimeChannel } from "@supabase/supabase-js"
import { useEffect, useRef } from "react"

import { useIdle } from "@/hooks/use-idle"
import { useChosenStatus } from "@/lib/queries/settings"
import { useUserId } from "@/lib/stores/auth-store"
import { usePresenceStore, type LiveStatus, type PresenceMeta } from "@/lib/stores/presence-store"
import { getSupabase } from "@/lib/supabase/client"

export const IDLE_AFTER_MS = 10 * 60 * 1000

/** What this tab should announce: the chosen status, Idle after inactivity, or nothing (Invisible). */
export function useOwnLiveStatus(): LiveStatus | null {
  const chosen = useChosenStatus()
  const idle = useIdle(IDLE_AFTER_MS)
  if (chosen === "invisible") return null
  if (chosen === "online" && idle) return "idle"
  return chosen
}

/**
 * Joins the shared `presence:global` topic: receives everyone's status and announces ours.
 * Presence drops automatically when a tab disconnects, so "offline" needs no cleanup.
 */
export function usePresenceSync() {
  const userId = useUserId()
  const status = useOwnLiveStatus()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const statusRef = useRef(status)

  useEffect(() => {
    const supabase = getSupabase()
    const { sync, clear } = usePresenceStore.getState()
    let cancelled = false
    let channel: RealtimeChannel | null = null

    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return
      // A unique key per tab: tabs sharing a key drop each other when one closes.
      // The store groups metas by user_id.
      channel = supabase.channel("presence:global", {
        config: { private: true, presence: { key: crypto.randomUUID() } },
      })
      channel
        .on("presence", { event: "sync" }, () => {
          sync(channel!.presenceState<PresenceMeta>() as Record<string, PresenceMeta[]>)
        })
        .subscribe((state) => {
          if (state === "SUBSCRIBED" && statusRef.current) {
            void channel!.track({ user_id: userId, status: statusRef.current } satisfies PresenceMeta)
          }
        })
      channelRef.current = channel
    })

    return () => {
      cancelled = true
      channelRef.current = null
      clear()
      if (channel) void supabase.removeChannel(channel)
    }
  }, [userId])

  // Re-announce when the status changes; Invisible stops announcing.
  useEffect(() => {
    statusRef.current = status
    const channel = channelRef.current
    if (!channel) return
    if (status) void channel.track({ user_id: userId, status } satisfies PresenceMeta)
    else void channel.untrack()
  }, [status, userId])
}
