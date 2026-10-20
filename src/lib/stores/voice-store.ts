import { create } from "zustand"
import { persist } from "zustand/middleware"

type VoiceState = {
  selfMute: boolean
  selfDeaf: boolean
  toggleMute: () => void
  toggleDeaf: () => void
}

/** Local voice controls. Milestone 9 connects these to a real voice session. */
export const useVoiceStore = create<VoiceState>()(
  persist(
    (set) => ({
      selfMute: false,
      selfDeaf: false,
      // Unmuting while deafened also undeafens, as in Discord.
      toggleMute: () =>
        set((s) =>
          s.selfMute && s.selfDeaf
            ? { selfMute: false, selfDeaf: false }
            : { selfMute: !s.selfMute }
        ),
      // Deafening also mutes; undeafening restores the mic.
      toggleDeaf: () =>
        set((s) =>
          s.selfDeaf
            ? { selfDeaf: false, selfMute: false }
            : { selfDeaf: true, selfMute: true }
        ),
    }),
    { name: "ktcord-voice" }
  )
)
