"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"

import { listChannelOverwrites, setChannelOverwrite } from "@/lib/api/channels"
import { applyOverwrites } from "@/lib/permissions"
import { useUserId } from "@/lib/stores/auth-store"

import { qk } from "./keys"
import { useChannels, useMembers, useRoles, useServerPermissions } from "./servers"

export function useChannelOverwrites(serverId: string | null | undefined) {
  return useQuery({
    queryKey: qk.channelOverwrites(serverId ?? ""),
    queryFn: () => listChannelOverwrites(serverId!),
    enabled: Boolean(serverId),
    staleTime: 60_000,
  })
}

export function useSetChannelOverwrite(serverId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: setChannelOverwrite,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.channelOverwrites(serverId) })
      void queryClient.invalidateQueries({ queryKey: qk.channels(serverId) })
    },
  })
}

/**
 * Effective permissions per channel of a server (server permissions with the channel's
 * overrides applied), as a lookup. Threads use their parent channel, as in the database.
 */
export function useChannelPermissionResolver(serverId: string | null | undefined) {
  const userId = useUserId()
  const { ready, permissions } = useServerPermissions(serverId ?? undefined)
  const { data: overwrites } = useChannelOverwrites(serverId)
  const { data: channels } = useChannels(serverId ?? undefined)
  const { data: roles } = useRoles(serverId ?? undefined)
  const { data: members } = useMembers(serverId ?? undefined)

  const everyoneRoleId = useMemo(() => roles?.find((r) => r.is_default)?.id, [roles])
  const memberRoleIds = useMemo(() => members?.find((m) => m.user_id === userId)?.role_ids ?? [], [members, userId])

  const resolve = useCallback(
    (channelId: string): number => {
      const channel = channels?.find((c) => c.id === channelId)
      const target = channel?.type === "thread" && channel.parent_id ? channel.parent_id : channelId
      return applyOverwrites({
        base: permissions,
        overwrites: (overwrites ?? []).filter((o) => o.channel_id === target),
        everyoneRoleId,
        memberRoleIds,
        userId,
      })
    },
    [channels, overwrites, permissions, everyoneRoleId, memberRoleIds, userId]
  )
  return { ready: ready && overwrites !== undefined, resolve }
}

/** Effective permissions in one channel. */
export function useChannelPermissions(serverId: string | null | undefined, channelId: string) {
  const { ready, resolve } = useChannelPermissionResolver(serverId)
  return { ready, permissions: resolve(channelId) }
}
