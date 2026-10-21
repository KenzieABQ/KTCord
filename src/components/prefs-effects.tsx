"use client"

import { useEffect } from "react"

import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { usePrefsStore } from "@/lib/stores/prefs-store"

/** Applies this device's appearance preferences to the document. */
export function PrefsEffects() {
  const chatFontSize = usePrefsStore((s) => s.chatFontSize)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    document.documentElement.style.setProperty("--chat-font-size", `${chatFontSize}px`)
  }, [chatFontSize])

  useEffect(() => {
    document.documentElement.toggleAttribute("data-reduced-motion", reducedMotion)
  }, [reducedMotion])

  // Settings changed in another tab apply here too.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === usePrefsStore.persist.getOptions().name) void usePrefsStore.persist.rehydrate()
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  return null
}
