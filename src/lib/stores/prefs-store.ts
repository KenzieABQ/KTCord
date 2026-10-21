import { create } from "zustand"
import { persist } from "zustand/middleware"

/** Font sizes offered by the chat font scaling slider, in px. */
export const CHAT_FONT_SIZES = [12, 14, 15, 16, 18, 20, 24] as const
export const DEFAULT_CHAT_FONT_SIZE = 16

export type MessageDisplay = "cozy" | "compact"

/** Per-device preferences (this browser only), like Discord's App Settings. */
type PrefsState = {
  messageDisplay: MessageDisplay
  chatFontSize: number
  reducedMotion: boolean
  /** Show a desktop notification when the tab is in the background (needs browser permission). */
  desktopNotifications: boolean
  /** Show an in-app toast for new messages while KTCord is open. */
  inAppToasts: boolean
  notificationSound: boolean

  set: (patch: Partial<Omit<PrefsState, "set">>) => void
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      messageDisplay: "cozy",
      chatFontSize: DEFAULT_CHAT_FONT_SIZE,
      reducedMotion: false,
      desktopNotifications: true,
      inAppToasts: true,
      notificationSound: true,
      set: (patch) => set(patch),
    }),
    {
      name: "ktcord-prefs",
      partialize: (s) => ({
        messageDisplay: s.messageDisplay,
        chatFontSize: s.chatFontSize,
        reducedMotion: s.reducedMotion,
        desktopNotifications: s.desktopNotifications,
        inAppToasts: s.inAppToasts,
        notificationSound: s.notificationSound,
      }),
    }
  )
)
