import { useEffect, useState } from "react"
import { create } from "zustand"

/** How long a typing ping lasts without a refresh. Senders ping every few seconds while typing. */
export const TYPING_TTL_MS = 8000

type TypingState = {
  /** channelId → userId → expiry timestamp (ms). */
  byChannel: Record<string, Record<string, number>>
  start: (channelId: string, userId: string) => void
  stop: (channelId: string, userId: string) => void
  prune: () => void
}

export const useTypingStore = create<TypingState>()((set) => ({
  byChannel: {},
  start: (channelId, userId) =>
    set((s) => ({
      byChannel: {
        ...s.byChannel,
        [channelId]: { ...s.byChannel[channelId], [userId]: Date.now() + TYPING_TTL_MS },
      },
    })),
  stop: (channelId, userId) =>
    set((s) => {
      if (!s.byChannel[channelId]?.[userId]) return s
      const next = { ...s.byChannel[channelId] }
      delete next[userId]
      return { byChannel: { ...s.byChannel, [channelId]: next } }
    }),
  prune: () =>
    set((s) => {
      const now = Date.now()
      let changed = false
      const byChannel: TypingState["byChannel"] = {}
      for (const [channelId, users] of Object.entries(s.byChannel)) {
        const kept: Record<string, number> = {}
        for (const [userId, expires] of Object.entries(users)) {
          if (expires > now) kept[userId] = expires
          else changed = true
        }
        byChannel[channelId] = kept
      }
      return changed ? { byChannel } : s
    }),
}))

/** User ids typing in a channel right now, excluding `selfId`. Expired pings drop off on their own. */
export function useTypingUsers(channelId: string, selfId: string): string[] {
  const users = useTypingStore((s) => s.byChannel[channelId])
  const prune = useTypingStore((s) => s.prune)
  const [, tick] = useState(0)

  const ids = Object.keys(users ?? {}).filter((id) => id !== selfId)
  const active = ids.length > 0

  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => {
      prune()
      tick((n) => n + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [active, prune])

  return ids
}

/** "A is typing…", "A and B are typing…", "A, B, and C are typing…", "Several people are typing…" */
export function describeTyping(names: string[]): string | null {
  if (names.length === 0) return null
  if (names.length === 1) return `${names[0]} is typing…`
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
  if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]} are typing…`
  return "Several people are typing…"
}
