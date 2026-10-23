"use client"

import { useEffect, useState } from "react"

import { useComposerStore } from "@/lib/stores/composer-store"

import { useChat } from "./chat-context"

/**
 * Slow mode for the open channel: whether it applies to you, the seconds left before you
 * can send again, and `started()` to call after sending. The database enforces the same rule.
 */
export function useSlowmode() {
  const { channel, slowmodeSeconds, canBypassSlowmode } = useChat()
  const until = useComposerStore((s) => s.cooldowns[channel.id] ?? 0)
  const active = slowmodeSeconds > 0 && !canBypassSlowmode
  const [now, setNow] = useState(() => Date.now())

  // Tick once a second while a countdown is running.
  useEffect(() => {
    if (!active || until <= Date.now()) return
    const timer = setInterval(() => {
      setNow(Date.now())
      if (Date.now() >= until) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [active, until])

  const remaining = active ? Math.max(0, Math.ceil((until - now) / 1000)) : 0
  return {
    active,
    seconds: slowmodeSeconds,
    remaining,
    started: () => {
      if (!active) return
      const next = Date.now() + slowmodeSeconds * 1000
      setNow(Date.now())
      useComposerStore.getState().setCooldown(channel.id, next)
    },
  }
}
