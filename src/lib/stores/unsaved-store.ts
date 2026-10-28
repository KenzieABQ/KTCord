import { create } from "zustand"

/**
 * Unsaved changes in settings: how many forms have them, and a counter bumped whenever
 * someone tries to leave anyway (the bar shakes and turns red, as in Discord).
 */
export const useUnsavedStore = create<{
  dirty: number
  attempts: number
  register: () => () => void
  blockedLeave: () => void
}>()((set) => ({
  dirty: 0,
  attempts: 0,
  register: () => {
    set((s) => ({ dirty: s.dirty + 1 }))
    return () => set((s) => ({ dirty: Math.max(0, s.dirty - 1) }))
  },
  blockedLeave: () => set((s) => ({ attempts: s.attempts + 1 })),
}))

/** True (and the bar shakes) when leaving now would lose unsaved changes. */
export function leaveBlocked(): boolean {
  const state = useUnsavedStore.getState()
  if (state.dirty === 0) return false
  state.blockedLeave()
  return true
}
