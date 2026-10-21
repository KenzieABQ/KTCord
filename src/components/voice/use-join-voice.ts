"use client"

import { useCallback } from "react"
import { toast } from "sonner"

import { isTimedOut } from "@/lib/moderation"
import { hasPermission, Permission } from "@/lib/permissions"
import { useMembers, useServerPermissions } from "@/lib/queries/servers"
import { useUserId } from "@/lib/stores/auth-store"
import { useVoiceStore } from "@/lib/stores/voice-store"

/**
 * Whether the user may connect to voice in a server, and a function that joins a channel
 * (explaining why not, if they can't). The database re-checks when presence is announced.
 */
export function useJoinVoice(serverId: string) {
  const userId = useUserId()
  const { ready, permissions } = useServerPermissions(serverId)
  const { data: members } = useMembers(serverId)
  const timedOut = isTimedOut(members?.find((m) => m.user_id === userId))
  const canConnect = ready && hasPermission(permissions, Permission.CONNECT) && !timedOut

  const join = useCallback(
    (channelId: string) => {
      if (!ready) return false
      if (timedOut) {
        toast.error("You can't join voice channels while you're timed out.")
        return false
      }
      if (!hasPermission(permissions, Permission.CONNECT)) {
        toast.error("You don't have permission to connect to voice channels here.")
        return false
      }
      useVoiceStore.getState().join(serverId, channelId)
      return true
    },
    [ready, timedOut, permissions, serverId]
  )

  return { ready, canConnect, join }
}
