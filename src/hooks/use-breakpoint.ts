"use client"

import { useSyncExternalStore } from "react"

export type Breakpoint = "mobile" | "tablet" | "desktop"

const TABLET = "(min-width: 768px)"
const DESKTOP = "(min-width: 1280px)"

function subscribe(onChange: () => void) {
  const queries = [window.matchMedia(TABLET), window.matchMedia(DESKTOP)]
  for (const q of queries) q.addEventListener("change", onChange)
  return () => {
    for (const q of queries) q.removeEventListener("change", onChange)
  }
}

function getSnapshot(): Breakpoint {
  if (window.matchMedia(DESKTOP).matches) return "desktop"
  if (window.matchMedia(TABLET).matches) return "tablet"
  return "mobile"
}

/** Matches the layout tiers: mobile (<768px), tablet (768–1279px), desktop (≥1280px). */
export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, getSnapshot, () => "desktop")
}
