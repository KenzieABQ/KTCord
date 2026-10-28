"use client"

import type { Track } from "livekit-client"
import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

/** Plays a LiveKit video track (sound comes separately, through the session's audio). */
export function VideoTrack({ track, mirror, className }: { track: Track; mirror?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    track.attach(element)
    return () => {
      track.detach(element)
    }
  }, [track])
  return <video ref={ref} autoPlay playsInline muted className={cn("size-full", mirror && "-scale-x-100", className)} />
}
