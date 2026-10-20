import { useSyncExternalStore } from "react"

let held = false
const listeners = new Set<() => void>()

function update(e: KeyboardEvent | FocusEvent) {
  const next = "shiftKey" in e ? e.shiftKey : false
  if (next === held) return
  held = next
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    window.addEventListener("keydown", update)
    window.addEventListener("keyup", update)
    window.addEventListener("blur", update)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      window.removeEventListener("keydown", update)
      window.removeEventListener("keyup", update)
      window.removeEventListener("blur", update)
    }
  }
}

/** Whether Shift is held right now (one shared listener for every message). */
export function useShiftHeld(): boolean {
  return useSyncExternalStore(subscribe, () => held, () => false)
}
