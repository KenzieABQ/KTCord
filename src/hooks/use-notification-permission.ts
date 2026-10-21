"use client"

import { useCallback, useReducer, useSyncExternalStore } from "react"

export type NotificationPermissionState = NotificationPermission | "unsupported"

function read(): NotificationPermissionState {
  return "Notification" in window ? Notification.permission : "unsupported"
}

function subscribe(onChange: () => void) {
  let status: PermissionStatus | undefined
  let active = true
  navigator.permissions
    ?.query({ name: "notifications" })
    .then((s) => {
      if (!active) return
      status = s
      s.addEventListener("change", onChange)
    })
    .catch(() => {})
  return () => {
    active = false
    status?.removeEventListener("change", onChange)
  }
}

/** The browser's desktop notification permission, and a way to ask for it. */
export function useNotificationPermission() {
  // Not every browser fires permission change events, so re-read after asking.
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const permission = useSyncExternalStore(subscribe, read, () => "default" as const)

  const request = useCallback(async () => {
    const result = await Notification.requestPermission()
    rerender()
    return result
  }, [])

  return { permission, request }
}
