"use client"

import type { RealtimeChannel } from "@supabase/supabase-js"
import { useCallback, useEffect, useRef } from "react"

import { useUserId } from "@/lib/stores/auth-store"
import { useTypingStore } from "@/lib/stores/typing-store"
import { getSupabase } from "@/lib/supabase/client"

/** Senders re-announce at most this often while they keep typing. */
const SEND_EVERY_MS = 3000

/**
 * Joins the private Broadcast topic `channel:<id>` for typing indicators.
 * Returns `notifyTyping` (throttled) and `notifyStopped` for the composer.
 */
export function useTypingChannel(channelId: string) {
  const userId = useUserId()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const lastSentRef = useRef(0)

  useEffect(() => {
    const supabase = getSupabase()
    const { start, stop } = useTypingStore.getState()
    let cancelled = false
    let channel: RealtimeChannel | null = null

    // Private topics are authorized with the user's JWT (RLS on realtime.messages).
    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return
      channel = supabase
        .channel(`channel:${channelId}`, { config: { private: true, broadcast: { self: false } } })
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          if (typeof payload?.userId === "string") start(channelId, payload.userId)
        })
        .on("broadcast", { event: "stop" }, ({ payload }) => {
          if (typeof payload?.userId === "string") stop(channelId, payload.userId)
        })
        .subscribe()
      channelRef.current = channel
    })

    return () => {
      cancelled = true
      channelRef.current = null
      lastSentRef.current = 0
      if (channel) void supabase.removeChannel(channel)
    }
  }, [channelId])

  const notifyTyping = useCallback(() => {
    const now = Date.now()
    if (now - lastSentRef.current < SEND_EVERY_MS) return
    lastSentRef.current = now
    void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId } })
  }, [userId])

  const notifyStopped = useCallback(() => {
    if (lastSentRef.current === 0) return
    lastSentRef.current = 0
    void channelRef.current?.send({ type: "broadcast", event: "stop", payload: { userId } })
  }, [userId])

  return { notifyTyping, notifyStopped }
}
