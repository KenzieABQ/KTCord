"use client"

import { useSyncExternalStore } from "react"

import { usePrefsStore } from "@/lib/stores/prefs-store"

const QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

/** True when the OS asks for less motion or the user turned it on in Appearance settings. */
export function useReducedMotion(): boolean {
  const pref = usePrefsStore((s) => s.reducedMotion)
  const system = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
  return pref || system
}
