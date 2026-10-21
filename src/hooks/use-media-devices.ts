"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * The browser's microphones or speakers. Names stay blank until the site has microphone
 * permission, so `requestAccess` asks for it once and lists again.
 */
export function useMediaDevices(kind: "audioinput" | "audiooutput") {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  /** Bumped to list again after permission is granted. */
  const [version, setVersion] = useState(0)
  const supported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.enumerateDevices)

  useEffect(() => {
    const media = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined
    if (!media?.enumerateDevices) return
    let active = true
    const load = () =>
      media.enumerateDevices().then((all) => {
        if (!active) return
        setDevices(all.filter((d) => d.kind === kind && d.deviceId !== "default" && d.deviceId !== "communications"))
      })
    void load()
    media.addEventListener("devicechange", load)
    return () => {
      active = false
      media.removeEventListener("devicechange", load)
    }
  }, [kind, version])

  const requestAccess = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    for (const track of stream.getTracks()) track.stop()
    setVersion((v) => v + 1)
  }, [])

  const labelled = devices.some((d) => d.label)
  return { devices, supported, labelled, requestAccess }
}
