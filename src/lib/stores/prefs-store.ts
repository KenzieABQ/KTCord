import { create } from "zustand"
import { persist } from "zustand/middleware"

/** Font sizes offered by the chat font scaling slider, in px. */
export const CHAT_FONT_SIZES = [12, 14, 15, 16, 18, 20, 24] as const
export const DEFAULT_CHAT_FONT_SIZE = 16

export type MessageDisplay = "cozy" | "compact"
export type InputMode = "voice-activity" | "push-to-talk"
/** Which dark palette to use when the theme is dark: Discord's Ash, Dark or Onyx (OLED black). */
export type DarkPalette = "ash" | "dark" | "onyx"

/** Space between message groups, in px (Discord's slider stops). */
export const GROUP_SPACINGS = [0, 4, 8, 16, 24] as const
export const DEFAULT_GROUP_SPACING = 16

/** Accent color presets; "" keeps KTCord's blurple. */
export const ACCENT_PRESETS = [
  { name: "Blurple", color: "" },
  { name: "Green", color: "#23a55a" },
  { name: "Yellow", color: "#f0b232" },
  { name: "Orange", color: "#f97316" },
  { name: "Red", color: "#f23f43" },
  { name: "Pink", color: "#eb459e" },
  { name: "Purple", color: "#9b59b6" },
  { name: "Sky", color: "#00a8fc" },
  { name: "Teal", color: "#1abc9c" },
] as const

/** Per-device preferences (this browser only), like Discord's App Settings. */
type PrefsState = {
  messageDisplay: MessageDisplay
  darkPalette: DarkPalette
  /** Custom accent (#rrggbb), or "" for the default blurple. */
  accentColor: string
  groupSpacing: number
  chatFontSize: number
  reducedMotion: boolean
  /** Show previews (embeds) for links posted in chat. */
  linkPreviews: boolean
  /** Show a desktop notification when the tab is in the background (needs browser permission). */
  desktopNotifications: boolean
  /** Show an in-app toast for new messages while KTCord is open. */
  inAppToasts: boolean
  notificationSound: boolean
  /** Microphone and speaker device ids ("" for the system default). */
  inputDeviceId: string
  outputDeviceId: string
  inputMode: InputMode
  /** KeyboardEvent.code held to transmit in push-to-talk mode. */
  pushToTalkKey: string
  noiseSuppression: boolean
  echoCancellation: boolean
  cameraDeviceId: string
  /** User Volume per person in voice, 0-100 (missing means 100). */
  userVolumes: Record<string, number>
  /** People muted for me only (Discord's "Mute" in their voice menu). */
  localMutes: Record<string, boolean>

  set: (patch: Partial<Omit<PrefsState, "set">>) => void
}

/** Playback volume for someone in voice, 0-1. */
export function playbackVolume(userId: string): number {
  const { userVolumes, localMutes } = usePrefsStore.getState()
  return localMutes[userId] ? 0 : (userVolumes[userId] ?? 100) / 100
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      messageDisplay: "cozy",
      darkPalette: "ash",
      accentColor: "",
      groupSpacing: DEFAULT_GROUP_SPACING,
      chatFontSize: DEFAULT_CHAT_FONT_SIZE,
      reducedMotion: false,
      linkPreviews: true,
      desktopNotifications: true,
      inAppToasts: true,
      notificationSound: true,
      inputDeviceId: "",
      outputDeviceId: "",
      inputMode: "voice-activity",
      pushToTalkKey: "Backquote",
      noiseSuppression: true,
      echoCancellation: true,
      cameraDeviceId: "",
      userVolumes: {},
      localMutes: {},
      set: (patch) => set(patch),
    }),
    {
      name: "ktcord-prefs",
      partialize: (s) => ({
        messageDisplay: s.messageDisplay,
        darkPalette: s.darkPalette,
        accentColor: s.accentColor,
        groupSpacing: s.groupSpacing,
        chatFontSize: s.chatFontSize,
        reducedMotion: s.reducedMotion,
        linkPreviews: s.linkPreviews,
        desktopNotifications: s.desktopNotifications,
        inAppToasts: s.inAppToasts,
        notificationSound: s.notificationSound,
        inputDeviceId: s.inputDeviceId,
        outputDeviceId: s.outputDeviceId,
        inputMode: s.inputMode,
        pushToTalkKey: s.pushToTalkKey,
        noiseSuppression: s.noiseSuppression,
        echoCancellation: s.echoCancellation,
        cameraDeviceId: s.cameraDeviceId,
        userVolumes: s.userVolumes,
        localMutes: s.localMutes,
      }),
    }
  )
)
