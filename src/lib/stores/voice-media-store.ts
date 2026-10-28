import type { Track } from "livekit-client"
import { create } from "zustand"

export type VideoSource = "camera" | "screen"

/**
 * Live video in the current voice room, by user id: cameras and screen shares, ours
 * included. Filled by the LiveKit session; the voice view attaches these to <video>s.
 */
export const useVoiceMediaStore = create<{
  videos: Record<string, Partial<Record<VideoSource, Track>>>
  setVideo: (userId: string, source: VideoSource, track: Track | null) => void
  clear: () => void
}>()((set) => ({
  videos: {},
  setVideo: (userId, source, track) =>
    set((s) => {
      const current = { ...s.videos[userId] }
      if (track) current[source] = track
      else delete current[source]
      const videos = { ...s.videos }
      if (Object.keys(current).length) videos[userId] = current
      else delete videos[userId]
      return { videos }
    }),
  clear: () => set({ videos: {} }),
}))

export function useVideo(userId: string, source: VideoSource): Track | undefined {
  return useVoiceMediaStore((s) => s.videos[userId]?.[source])
}
