"use client"

import { useMemo } from "react"

import { useVoiceModeration } from "@/lib/queries/moderation"
import { useVoiceRoster } from "@/lib/stores/voice-store"
import type { VoiceMember } from "@/lib/voice/roster"

/** The people in a voice channel with their server mute/deafen state. */
export function useVoicePeople(serverId: string | null, channelId: string): VoiceMember[] {
  const roster = useVoiceRoster(channelId)
  const { data: moderation } = useVoiceModeration(serverId)
  return useMemo(
    () =>
      roster.map((person) => {
        const state = moderation?.find((m) => m.user_id === person.userId)
        const serverMute = Boolean(state?.server_mute)
        return { ...person, serverMute, serverDeaf: Boolean(state?.server_deaf), speaking: person.speaking && !serverMute }
      }),
    [roster, moderation]
  )
}
