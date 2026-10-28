"use client"

import { useCallback } from "react"
import { toast } from "@/lib/toast"

import { isTimedOut } from "@/lib/moderation"
import { hasPermission, Permission } from "@/lib/permissions"
import { useChannelPermissionResolver } from "@/lib/queries/channel-permissions"
import { useMembers } from "@/lib/queries/servers"
import { useUserId } from "@/lib/stores/auth-store"
import { useVoiceStore } from "@/lib/stores/voice-store"

/**
 * Whether the user may connect to a voice channel (CONNECT there, after the channel's
 * overrides, and not timed out), and a function that joins one, explaining why not if it
 * can't. The database re-checks when presence is announced and when audio connects.
 */
export function useJoinVoice(serverId: string) {
  const userId = useUserId()
  const { ready, resolve } = useChannelPermissionResolver(serverId)
  const { data: members } = useMembers(serverId)
  const timedOut = isTimedOut(members?.find((m) => m.user_id === userId))

  const canConnect = useCallback(
    (channelId: string) => ready && !timedOut && hasPermission(resolve(channelId), Permission.CONNECT),
    [ready, timedOut, resolve]
  )

  const join = useCallback(
    (channelId: string) => {
      if (!ready) return false
      if (timedOut) {
        toast.error("You can't join voice channels while you're timed out.")
        return false
      }
      if (!hasPermission(resolve(channelId), Permission.CONNECT)) {
        toast.error("You don't have permission to connect to this voice channel.")
        return false
      }
      useVoiceStore.getState().join(serverId, channelId)
      return true
    },
    [ready, timedOut, resolve, serverId]
  )

  return { ready, canConnect, join }
}
