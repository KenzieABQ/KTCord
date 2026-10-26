"use client"

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { Member, Role } from "@/lib/api/members"
import {
  AUDIT_PAGE_SIZE,
  banMember,
  createAutomodRule,
  createRole,
  deleteAutomodRule,
  deleteRole,
  kickMember,
  listAuditLog,
  listAutomodRules,
  listBans,
  listVoiceModeration,
  moderateVoice,
  setVoiceModeration,
  updateAutomodRule,
  type AutomodRuleInput,
  listChannelAccess,
  reorderRoles,
  setChannelAccess,
  setMemberRoles,
  timeoutMember,
  unbanMember,
  updateRole,
  type RolePatch,
} from "@/lib/api/moderation"

import { useUserId } from "@/lib/stores/auth-store"

import { qk } from "./keys"

/** After a kick, ban or timeout, make sure they're out of voice on the voice server too. */
function pullFromVoice(serverId: string, userId: string) {
  void moderateVoice(serverId, userId, "removed").catch(() => {
    // Their own app leaves voice anyway; this covers clients that don't.
  })
}

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
    onSuccess: (_d, userId) => {
      invalidate("members")
      pullFromVoice(serverId, userId)
    },
  })
}

export function useBanMember(serverId: string) {
  const invalidate = useServerInvalidator(serverId)
  return useMutation({
    mutationFn: ({ userId, reason, deleteSeconds }: { userId: string; reason: string; deleteSeconds: number }) =>
      banMember(serverId, userId, reason, deleteSeconds),
    onSuccess: (_d, { userId }) => {
      invalidate("members", "bans")
      pullFromVoice(serverId, userId)
    },
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
    onSuccess: (_d, { userId, until }) => {
      queryClient.setQueryData<Member[]>(qk.members(serverId), (list) =>
        list?.map((m) => (m.user_id === userId ? { ...m, timeout_until: until?.toISOString() ?? null } : m))
      )
      if (until && until.getTime() > Date.now()) pullFromVoice(serverId, userId)
    },
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

// ---------------------------------------------------------------------------
// Voice moderation
// ---------------------------------------------------------------------------

export function useVoiceModeration(serverId: string | null | undefined) {
  return useQuery({
    queryKey: qk.voiceModeration(serverId ?? ""),
    queryFn: () => listVoiceModeration(serverId!),
    enabled: Boolean(serverId),
    staleTime: 60_000,
  })
}

/** Server mute/deafen someone, then apply it to the room they're in right now. */
export function useSetVoiceModeration(serverId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, mute, deaf }: { userId: string; mute: boolean; deaf: boolean }) => {
      await setVoiceModeration(serverId, userId, { mute, deaf })
      await moderateVoice(serverId, userId, "sync").catch(() => {})
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.voiceModeration(serverId) }),
  })
}

export function useDisconnectFromVoice(serverId: string) {
  return useMutation({ mutationFn: (userId: string) => moderateVoice(serverId, userId, "disconnect") })
}

// ---------------------------------------------------------------------------
// Audit log and AutoMod
// ---------------------------------------------------------------------------

export function useAuditLog(serverId: string, filter: { actorId?: string; action?: string }, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.auditLog(serverId, filter.actorId ?? "", filter.action ?? ""),
    queryFn: ({ pageParam }) => listAuditLog(serverId, { ...filter, before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.length === AUDIT_PAGE_SIZE ? last.at(-1)?.created_at : undefined),
    enabled,
  })
}

export function useAutomodRules(serverId: string, enabled = true) {
  return useQuery({ queryKey: qk.automodRules(serverId), queryFn: () => listAutomodRules(serverId), enabled })
}

export function useSaveAutomodRule(serverId: string) {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: AutomodRuleInput }) =>
      id ? updateAutomodRule(id, input) : createAutomodRule(serverId, userId, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.automodRules(serverId) }),
  })
}

export function useToggleAutomodRule(serverId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => updateAutomodRule(id, { enabled }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.automodRules(serverId) }),
  })
}

export function useDeleteAutomodRule(serverId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteAutomodRule,
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.automodRules(serverId) }),
  })
}
