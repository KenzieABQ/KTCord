import { create } from "zustand"

import type { PresenceStatus } from "@/components/profile/status-dot"

export type LiveStatus = Exclude<PresenceStatus, "offline">

/** What each connected tab announces on the presence topic. */
export type PresenceMeta = { user_id: string; status: LiveStatus }

type PresenceState = {
  /** userId → live status. Missing means offline (or invisible). */
  byUser: Record<string, LiveStatus>
  sync: (state: Record<string, PresenceMeta[]>) => void
  clear: () => void
}

/**
 * Collapses one user's tabs/devices into a single status: Do Not Disturb wins (it's a choice),
 * then any active tab makes them Online, otherwise they're Idle.
 */
export function combineMetas(metas: PresenceMeta[]): LiveStatus | null {
  if (metas.length === 0) return null
  if (metas.some((m) => m.status === "dnd")) return "dnd"
  if (metas.some((m) => m.status === "online")) return "online"
  return "idle"
}

export const usePresenceStore = create<PresenceState>()((set) => ({
  byUser: {},
  sync: (state) => {
    const grouped: Record<string, PresenceMeta[]> = {}
    for (const metas of Object.values(state)) {
      for (const meta of metas) {
        if (!meta?.user_id) continue
        ;(grouped[meta.user_id] ??= []).push(meta)
      }
    }
    const byUser: Record<string, LiveStatus> = {}
    for (const [userId, metas] of Object.entries(grouped)) {
      const status = combineMetas(metas)
      if (status) byUser[userId] = status
    }
    set({ byUser })
  },
  clear: () => set({ byUser: {} }),
}))

export function usePresenceStatus(userId: string | null | undefined): PresenceStatus {
  return usePresenceStore((s) => (userId ? (s.byUser[userId] ?? "offline") : "offline"))
}
