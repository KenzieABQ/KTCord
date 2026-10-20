"use client"

import { useEffect, useRef, type RefObject } from "react"

const MIN_DISTANCE = 70
const MAX_DURATION_MS = 600

/**
 * Calls `onSwipeRight` / `onSwipeLeft` for quick, mostly-horizontal touch swipes on `ref`.
 * Vertical scrolling and swipes that start inside horizontally scrollable content are ignored.
 */
export function useSwipe(
  ref: RefObject<HTMLElement | null>,
  handlers: { onSwipeRight?: () => void; onSwipeLeft?: () => void },
  enabled = true
) {
  const latest = useRef(handlers)
  useEffect(() => {
    latest.current = handlers
  })

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    let start: { x: number; y: number; t: number } | null = null

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) return
      const target = e.target as HTMLElement
      if (target.closest("[data-no-swipe], input, textarea, [contenteditable=true]")) {
        start = null
        return
      }
      const t = e.touches[0]
      start = { x: t.clientX, y: t.clientY, t: Date.now() }
    }

    function onEnd(e: TouchEvent) {
      if (!start) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      const quick = Date.now() - start.t < MAX_DURATION_MS
      start = null
      if (!quick || Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (dx > 0) latest.current.onSwipeRight?.()
      else latest.current.onSwipeLeft?.()
    }

    el.addEventListener("touchstart", onStart, { passive: true })
    el.addEventListener("touchend", onEnd, { passive: true })
    return () => {
      el.removeEventListener("touchstart", onStart)
      el.removeEventListener("touchend", onEnd)
    }
  }, [ref, enabled])
}
