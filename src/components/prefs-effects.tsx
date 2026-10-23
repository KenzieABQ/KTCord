"use client"

import { useEffect } from "react"

import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { luminance } from "@/lib/profile-display"
import { usePrefsStore } from "@/lib/stores/prefs-store"

/** Darkens a #rrggbb color by `amount` (0–1), for the accent's hover shade. */
function darken(hex: string, amount: number) {
  const channel = (i: number) =>
    Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount))
      .toString(16)
      .padStart(2, "0")
  return `#${channel(1)}${channel(3)}${channel(5)}`
}

/** Applies this device's appearance preferences to the document. */
export function PrefsEffects() {
  const chatFontSize = usePrefsStore((s) => s.chatFontSize)
  const darkPalette = usePrefsStore((s) => s.darkPalette)
  const accentColor = usePrefsStore((s) => s.accentColor)
  const groupSpacing = usePrefsStore((s) => s.groupSpacing)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    document.documentElement.dataset.darkPalette = darkPalette
  }, [darkPalette])

  // A custom accent replaces blurple everywhere it's used (buttons, links to settings, rings).
  useEffect(() => {
    const style = document.documentElement.style
    if (!/^#[0-9a-f]{6}$/i.test(accentColor)) {
      for (const name of ["--brand", "--brand-hover", "--primary-foreground"]) style.removeProperty(name)
      return
    }
    style.setProperty("--brand", accentColor)
    style.setProperty("--brand-hover", darken(accentColor, 0.15))
    // Light accents (yellow, sky) need dark text on buttons.
    style.setProperty("--primary-foreground", luminance(accentColor) > 0.45 ? "#060607" : "#ffffff")
  }, [accentColor])

  useEffect(() => {
    document.documentElement.style.setProperty("--group-spacing", `${groupSpacing}px`)
  }, [groupSpacing])

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
