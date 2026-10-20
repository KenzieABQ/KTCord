"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { Member, Role } from "@/lib/api/members"
import {
  banMember,
  createRole,
  deleteRole,
  kickMember,
  listBans,
  listChannelAccess,
  reorderRoles,
  setChannelAccess,
  setMemberRoles,
  timeoutMember,
  unbanMember,
  updateRole,
  type RolePatch,
} from "@/lib/api/moderation"

import { qk } from "./keys"

/** Every moderation write refreshes the lists it touches; Realtime keeps other clients in sync. */
function useServerInvalidator(serverId: string) {
  const queryClient = useQueryClient()
  return (...keys: ("roles" | "members" | "channels" | "bans")[]) => {
    for (const key of keys) {
      const queryKey =
        key === "bans" ? qk.bans(serverId) : key === "roles" ? qk.roles(serverId) : key === "members" ? qk.members(serverId) : qk.channels(serverId)
      void queryClient.invalidateQueries({ queryKey })
    }
  }
}

export function useCreateRole(serverId: string) {
  const invalidate = useServerInvalidator(serverId)
  return useMutation({
    mutationFn: (input: { name: string; color?: string | null; permissions?: number }) => createRole(serverId, input),
    onSuccess: () => invalidate("roles"),
  })
}

export function useUpdateRole(serverId: string) {
  const queryClient = useQueryClient()
  const invalidate = useServerInvalidator(serverId)
  return useMutation({
    mutationFn: ({ roleId, patch }: { roleId: string; patch: RolePatch }) => updateRole(roleId, patch),
    onSuccess: (role) => {
      queryClient.setQueryData<Role[]>(qk.roles(serverId), (list) => list?.map((r) => (r.id === role.id ? role : r)))
      invalidate("channels")
    },
  })
}

export function useDeleteRole(serverId: string) {
  const invalidate = useServerInvalidator(serverId)
  return useMutation({
    mutationFn: (roleId: string) => deleteRole(roleId),
    onSuccess: () => invalidate("roles", "members", "channels"),
  })
}

/** Optimistic: positions update at once and roll back on error. */
export function useReorderRoles(serverId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (roleIds: string[]) => reorderRoles(serverId, roleIds),
    onMutate: async (roleIds) => {
      await queryClient.cancelQueries({ queryKey: qk.roles(serverId) })
      const previous = queryClient.getQueryData<Role[]>(qk.roles(serverId))
      queryClient.setQueryData<Role[]>(qk.roles(serverId), (list) =>
        list
          ?.map((r) => {
            const i = roleIds.indexOf(r.id)
            return i === -1 ? r : { ...r, position: roleIds.length - i }
          })
          .sort((a, b) => b.position - a.position)
      )
      return { previous }
    },
    onError: (_e, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(qk.roles(serverId), context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.roles(serverId) }),
  })
}

export function useSetMemberRoles(serverId: string) {
  const queryClient = useQueryClient()
  const invalidate = useServerInvalidator(serverId)
  return useMutation({
    mutationFn: ({ userId, roleIds }: { userId: string; roleIds: string[] }) => setMemberRoles(serverId, userId, roleIds),
    onMutate: ({ userId, roleIds }) => {
      const previous = queryClient.getQueryData<Member[]>(qk.members(serverId))
      queryClient.setQueryData<Member[]>(qk.members(serverId), (list) =>
        list?.map((m) => (m.user_id === userId ? { ...m, role_ids: roleIds } : m))
      )
      return { previous }
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(qk.members(serverId), context.previous)
    },
    onSettled: () => invalidate("members", "channels"),
  })
}

export function useKickMember(serverId: string) {
  const invalidate = useServerInvalidator(serverId)
  return useMutation({
    mutationFn: (userId: string) => kickMember(serverId, userId),
    onSuccess: () => invalidate("members"),
  })
}

export function useBanMember(serverId: string) {
  const invalidate = useServerInvalidator(serverId)
  return useMutation({
    mutationFn: ({ userId, reason, deleteSeconds }: { userId: string; reason: string; deleteSeconds: number }) =>
      banMember(serverId, userId, reason, deleteSeconds),
    onSuccess: () => invalidate("members", "bans"),
  })
}

export function useUnbanMember(serverId: string) {
  const invalidate = useServerInvalidator(serverId)
  return useMutation({
    mutationFn: (userId: string) => unbanMember(serverId, userId),
    onSuccess: () => invalidate("bans"),
  })
}

export function useTimeoutMember(serverId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, until }: { userId: string; until: Date | null }) => timeoutMember(serverId, userId, until),
    onSuccess: (_d, { userId, until }) =>
      queryClient.setQueryData<Member[]>(qk.members(serverId), (list) =>
        list?.map((m) => (m.user_id === userId ? { ...m, timeout_until: until?.toISOString() ?? null } : m))
      ),
  })
}

export function useBans(serverId: string, enabled = true) {
  return useQuery({ queryKey: qk.bans(serverId), queryFn: () => listBans(serverId), enabled })
}

export function useChannelAccess(channelId: string, enabled = true) {
  return useQuery({
    queryKey: qk.channelAccess(channelId),
    queryFn: () => listChannelAccess(channelId),
    enabled,
  })
}

export function useSetChannelAccess(serverId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ channelId, isPrivate, roleIds }: { channelId: string; isPrivate: boolean; roleIds: string[] }) =>
      setChannelAccess(channelId, isPrivate, roleIds),
    onSuccess: (_d, { channelId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.channelAccess(channelId) })
      void queryClient.invalidateQueries({ queryKey: qk.channels(serverId) })
    },
  })
}
