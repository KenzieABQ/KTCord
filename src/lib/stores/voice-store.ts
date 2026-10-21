import { useEffect } from "react"
import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { VoiceMember } from "@/lib/voice/roster"

export type VoiceStatus = "connecting" | "connected" | "reconnecting"

/**
 * Where this connection's audio stands: waiting for a token, live through LiveKit, or
 * unavailable because no voice server is configured (presence-only voice).
 */
export type VoiceAudio = "pending" | "livekit" | "unavailable"

/** The voice channel this tab is connected to. Not remembered: a reload leaves voice, as in Discord. */
export type VoiceConnection = {
  serverId: string
  channelId: string
  status: VoiceStatus
  /** When this tab joined; announced in presence so rosters list people in join order. */
  joinedAt: string
  audio: VoiceAudio
  /** False without the SPEAK permission: listen-only. */
  canSpeak: boolean
}

type VoiceState = {
  selfMute: boolean
  selfDeaf: boolean
  connection: VoiceConnection | null
  /** Whether this user's microphone is picking up speech right now. */
  speaking: boolean
  /** Push-to-talk key held down. */
  pushToTalkHeld: boolean

  toggleMute: () => void
  toggleDeaf: () => void
  /** Joins a voice channel, leaving any other one first. */
  join: (serverId: string, channelId: string) => void
  leave: () => void
  /** Starts the current connection over (new token and room), e.g. after losing the voice server. */
  rejoin: () => void
  setStatus: (status: VoiceStatus) => void
  setAudio: (audio: VoiceAudio, canSpeak: boolean) => void
  setSpeaking: (speaking: boolean) => void
  setPushToTalkHeld: (held: boolean) => void
}

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set) => ({
      selfMute: false,
      selfDeaf: false,
      connection: null,
      speaking: false,
      pushToTalkHeld: false,

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
      join: (serverId, channelId) =>
        set((s) =>
          s.connection?.channelId === channelId
            ? s
            : {
                connection: {
                  serverId,
                  channelId,
                  status: "connecting",
                  joinedAt: new Date().toISOString(),
                  audio: "pending",
                  canSpeak: true,
                },
                speaking: false,
              }
        ),
      leave: () => set({ connection: null, speaking: false, pushToTalkHeld: false }),
      rejoin: () =>
        set((s) =>
          s.connection
            ? {
                connection: { ...s.connection, status: "reconnecting", audio: "pending", joinedAt: new Date().toISOString() },
                speaking: false,
              }
            : s
        ),
      setStatus: (status) =>
        set((s) => (s.connection && s.connection.status !== status ? { connection: { ...s.connection, status } } : s)),
      // Without a voice server there's nothing more to wait for once presence is announced.
      setAudio: (audio, canSpeak) =>
        set((s) =>
          s.connection
            ? {
                connection: {
                  ...s.connection,
                  audio,
                  canSpeak,
                  status: audio === "unavailable" ? "connected" : s.connection.status,
                },
              }
            : s
        ),
      setSpeaking: (speaking) => set((s) => (s.speaking === speaking ? s : { speaking })),
      setPushToTalkHeld: (pushToTalkHeld) => set((s) => (s.pushToTalkHeld === pushToTalkHeld ? s : { pushToTalkHeld })),
    }),
    {
      name: "ktcord-voice",
      partialize: (s) => ({ selfMute: s.selfMute, selfDeaf: s.selfDeaf }),
    }
  )
)

const NOBODY: VoiceMember[] = []

/**
 * Who is in each watched voice channel, from Realtime Presence. Views that show a roster
 * register the channels they need with useWatchVoiceChannels; <VoiceSync /> subscribes to those.
 */
export const useVoiceRosterStore = create<{
  rosters: Record<string, VoiceMember[]>
  /** How many mounted views want each channel's roster. */
  watchers: Record<string, number>
  setRoster: (channelId: string, members: VoiceMember[]) => void
  clearRoster: (channelId: string) => void
  watch: (channelIds: string[]) => void
  unwatch: (channelIds: string[]) => void
}>()((set) => ({
  rosters: {},
  watchers: {},
  setRoster: (channelId, members) => set((s) => ({ rosters: { ...s.rosters, [channelId]: members } })),
  watch: (ids) =>
    set((s) => {
      const watchers = { ...s.watchers }
      for (const id of ids) watchers[id] = (watchers[id] ?? 0) + 1
      return { watchers }
    }),
  unwatch: (ids) =>
    set((s) => {
      const watchers = { ...s.watchers }
      for (const id of ids) {
        if ((watchers[id] ?? 0) <= 1) delete watchers[id]
        else watchers[id] -= 1
      }
      return { watchers }
    }),
  clearRoster: (channelId) =>
    set((s) => {
      if (!(channelId in s.rosters)) return s
      const rosters = { ...s.rosters }
      delete rosters[channelId]
      return { rosters }
    }),
}))

/** The people in a voice channel, in join order. */
export function useVoiceRoster(channelId: string): VoiceMember[] {
  return useVoiceRosterStore((s) => s.rosters[channelId] ?? NOBODY)
}

/** Keeps these voice channels' rosters live while the calling component is mounted. */
export function useWatchVoiceChannels(channelIds: string[]) {
  const key = channelIds.join(",")
  useEffect(() => {
    const ids = key ? key.split(",") : []
    const { watch, unwatch } = useVoiceRosterStore.getState()
    watch(ids)
    return () => unwatch(ids)
  }, [key])
}
