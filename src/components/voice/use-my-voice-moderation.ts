"use client"

import { useVoiceModeration } from "@/lib/queries/moderation"
import { useUserId } from "@/lib/stores/auth-store"
import { useVoiceStore } from "@/lib/stores/voice-store"

/** Whether a moderator has server muted or deafened you in the server you're in voice in. */
export function useMyVoiceModeration() {
  const userId = useUserId()
  const serverId = useVoiceStore((s) => s.connection?.serverId ?? null)
  const { data } = useVoiceModeration(serverId)
  const mine = data?.find((m) => m.user_id === userId)
  return { serverMute: Boolean(mine?.server_mute), serverDeaf: Boolean(mine?.server_deaf) }
}
