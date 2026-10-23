import { create } from "zustand"
import { persist } from "zustand/middleware"

type Usage = Record<string, { count: number; last: number }>

/** The emoji picker's memory on this device: your skin tone and what you use most. */
export const useEmojiStore = create<{
  /** 0 = default yellow, 1–5 light to dark. */
  skinTone: number
  /** Keyed by the emoji character or custom emoji token. */
  usage: Usage
  setSkinTone: (tone: number) => void
  recordUse: (value: string) => void
}>()(
  persist(
    (set) => ({
      skinTone: 0,
      usage: {},
      setSkinTone: (skinTone) => set({ skinTone }),
      recordUse: (value) =>
        set((s) => {
          const usage: Usage = { ...s.usage, [value]: { count: (s.usage[value]?.count ?? 0) + 1, last: Date.now() } }
          // Keep the memory small: the 60 most used.
          const keep = frequentEmoji(usage, 60)
          return { usage: Object.fromEntries(keep.map((k) => [k, usage[k]])) }
        }),
    }),
    { name: "ktcord-emoji" }
  )
)

/** Most used first, then most recent. */
export function frequentEmoji(usage: Usage, limit: number): string[] {
  return Object.entries(usage)
    .sort(([, a], [, b]) => b.count - a.count || b.last - a.last)
    .slice(0, limit)
    .map(([value]) => value)
}
