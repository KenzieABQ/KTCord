"use client"

import { useEffect, useState } from "react"

const ACTIVITY_EVENTS = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const

/** True after `timeoutMs` without keyboard, mouse or touch input in this tab. */
export function useIdle(timeoutMs: number): boolean {
  const [idle, setIdle] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let last = 0
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setIdle(true), timeoutMs)
    }
    const onActivity = () => {
      // Throttle: pointermove fires constantly.
      const now = Date.now()
      if (now - last < 1000) return
      last = now
      setIdle(false)
      arm()
    }
    arm()
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, onActivity, { passive: true })
    return () => {
      clearTimeout(timer)
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity)
    }
  }, [timeoutMs])

  return idle
}
