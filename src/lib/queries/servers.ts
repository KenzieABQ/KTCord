"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"

import {
  createChannel,
  deleteChannel,
  listChannels,
  reorderChannels,
  updateChannel,
  type Channel,
  type ChannelPlacement,
} from "@/lib/api/channels"
import {
  createInvite,
  getInvitePreview,
  joinServerByInvite,
  listInvites,
  revokeInvite,
  type Invite,
} from "@/lib/api/invites"
import { listMembers, listRoles } from "@/lib/api/members"
import {
  createServer,
  deleteServer,
  leaveServer,
  listMyServers,
  updateServer,
  type JoinedServer,
} from "@/lib/api/servers"
import { applyPlacements, buildChannelTree } from "@/lib/channels/tree"
import { computeServerPermissions, topRolePosition } from "@/lib/permissions"
import { useUserId } from "@/lib/stores/auth-store"

import { qk } from "./keys"

// ---------------------------------------------------------------------------
// Servers
// ---------------------------------------------------------------------------

export function useMyServers() {
  const userId = useUserId()
  return useQuery({
    queryKey: qk.servers(userId),
    queryFn: () => listMyServers(userId),
    staleTime: 5 * 60_000,
  })
}

export function useServer(serverId: string | undefined) {
  const { data, ...rest } = useMyServers()
  const server = useMemo(() => data?.find((s) => s.id === serverId), [data, serverId])
  return { ...rest, data: server }
}

export function useCreateServer() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ name, icon }: { name: string; icon: Blob | null }) => createServer(name, icon),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.servers(userId) }),
  })
}

export function useUpdateServer(serverId: string) {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: { name?: string; icon_url?: string | null }) => updateServer(serverId, patch),
    onSuccess: (server) =>
      queryClient.setQueryData<JoinedServer[]>(qk.servers(userId), (list) =>
        list?.map((s) => (s.id === server.id ? { ...s, ...server } : s))
      ),
  })
}

/** Drops a server from the cache after leaving or deleting it (Realtime may also do this). */
export function useForgetServer() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return (serverId: string) => {
    queryClient.setQueryData<JoinedServer[]>(qk.servers(userId), (list) =>
      list?.filter((s) => s.id !== serverId)
    )
    for (const key of [qk.channels, qk.members, qk.roles, qk.invites]) {
      queryClient.removeQueries({ queryKey: key(serverId) })
    }
  }
}

export function useLeaveServer() {
  const forget = useForgetServer()
  return useMutation({
    mutationFn: (serverId: string) => leaveServer(serverId),
    onSuccess: (_, serverId) => forget(serverId),
  })
}

export function useDeleteServer() {
  const forget = useForgetServer()
  return useMutation({
    mutationFn: (serverId: string) => deleteServer(serverId),
    onSuccess: (_, serverId) => forget(serverId),
  })
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export function useChannels(serverId: string | undefined) {
  return useQuery({
    queryKey: qk.channels(serverId ?? ""),
    queryFn: () => listChannels(serverId!),
    enabled: Boolean(serverId),
    staleTime: 5 * 60_000,
  })
}

export function useChannelTree(serverId: string | undefined) {
  const query = useChannels(serverId)
  const tree = useMemo(() => (query.data ? buildChannelTree(query.data) : undefined), [query.data])
  return { ...query, tree }
}

export function useChannel(serverId: string | undefined, channelId: string | undefined) {
  const { data, ...rest } = useChannels(serverId)
  return { ...rest, data: data?.find((c) => c.id === channelId) }
}

function upsertChannel(list: Channel[] | undefined, channel: Channel) {
  if (!list) return list
  return list.some((c) => c.id === channel.id)
    ? list.map((c) => (c.id === channel.id ? channel : c))
    : [...list, channel]
}

export function useCreateChannel(serverId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { type: "text" | "voice" | "category"; name: string; parentId?: string | null }) =>
      createChannel({ serverId, ...input }),
    onSuccess: (channel) =>
      queryClient.setQueryData<Channel[]>(qk.channels(serverId), (list) => upsertChannel(list, channel)),
  })
}

export function useUpdateChannel(serverId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string; topic?: string | null; slowmode_seconds?: number }) =>
      updateChannel(id, patch),
    onSuccess: (channel) =>
      queryClient.setQueryData<Channel[]>(qk.channels(serverId), (list) => upsertChannel(list, channel)),
  })
}

export function useDeleteChannel(serverId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (channelId: string) => deleteChannel(channelId),
    onSuccess: (_, channelId) =>
      queryClient.setQueryData<Channel[]>(qk.channels(serverId), (list) =>
        list
          ?.filter((c) => c.id !== channelId)
          // Channels in a deleted category become uncategorized (ON DELETE SET NULL).
          .map((c) => (c.parent_id === channelId ? { ...c, parent_id: null } : c))
      ),
  })
}

/** Optimistic reorder: the sidebar moves at once and rolls back if the RPC fails. */
export function useReorderChannels(serverId: string) {
  const queryClient = useQueryClient()
  const key = qk.channels(serverId)
  return useMutation({
    mutationFn: (placements: ChannelPlacement[]) => reorderChannels(serverId, placements),
    onMutate: async (placements) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Channel[]>(key)
      queryClient.setQueryData<Channel[]>(key, (list) => list && applyPlacements(list, placements))
      return { previous }
    },
    onError: (_error, _placements, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
  })
}

// ---------------------------------------------------------------------------
// Members, roles and permissions
// ---------------------------------------------------------------------------

export function useMembers(serverId: string | undefined) {
  return useQuery({
    queryKey: qk.members(serverId ?? ""),
    queryFn: () => listMembers(serverId!),
    enabled: Boolean(serverId),
    staleTime: 60_000,
  })
}

export function useRoles(serverId: string | undefined) {
  return useQuery({
    queryKey: qk.roles(serverId ?? ""),
    queryFn: () => listRoles(serverId!),
    enabled: Boolean(serverId),
    staleTime: 5 * 60_000,
  })
}

/** The signed-in user's permissions in a server, mirroring public.server_permissions(). */
export function useServerPermissions(serverId: string | undefined) {
  const userId = useUserId()
  const { data: server } = useServer(serverId)
  const { data: roles } = useRoles(serverId)
  const { data: members } = useMembers(serverId)

  return useMemo(() => {
    if (!server || !roles || !members) {
      return { ready: false, permissions: 0, topPosition: 0, isOwner: false }
    }
    const me = members.find((m) => m.user_id === userId)
    const memberRoleIds = me?.role_ids ?? []
    return {
      ready: true,
      permissions: computeServerPermissions({
        userId,
        ownerId: server.owner_id,
        roles,
        memberRoleIds,
        isMember: Boolean(me),
      }),
      topPosition: topRolePosition({ userId, ownerId: server.owner_id, roles, memberRoleIds }),
      isOwner: server.owner_id === userId,
    }
  }, [server, roles, members, userId])
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

export function useInvites(serverId: string, enabled = true) {
  return useQuery({
    queryKey: qk.invites(serverId),
    queryFn: () => listInvites(serverId),
    enabled,
  })
}

export function useCreateInvite(serverId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (options: { maxAgeSeconds: number | null; maxUses: number | null }) =>
      createInvite(serverId, options),
    onSuccess: (invite) =>
      queryClient.setQueryData<Invite[]>(qk.invites(serverId), (list) => list && [invite, ...list]),
  })
}

export function useRevokeInvite(serverId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => revokeInvite(code),
    onSuccess: (_, code) =>
      queryClient.setQueryData<Invite[]>(qk.invites(serverId), (list) => list?.filter((i) => i.code !== code)),
  })
}

export function useInvitePreview(code: string | null) {
  return useQuery({
    queryKey: qk.invitePreview(code ?? ""),
    queryFn: () => getInvitePreview(code!),
    enabled: Boolean(code),
    retry: false,
  })
}

export function useJoinServer() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => joinServerByInvite(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.servers(userId) }),
  })
}
