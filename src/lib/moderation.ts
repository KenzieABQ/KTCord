"use client"

import { useMemo } from "react"

import type { Member, Role } from "@/lib/api/members"
import { hasPermission, Permission, topRolePosition } from "@/lib/permissions"
import { useMembers, useRoles, useServer, useServerPermissions } from "@/lib/queries/servers"
import { useUserId } from "@/lib/stores/auth-store"

export type ModerationAbilities = {
  /** The caller sits above the target (mirrors public.outranks()). */
  outranks: boolean
  canKick: boolean
  canBan: boolean
  canTimeout: boolean
  canManageRoles: boolean
  /** Roles the caller can add to or remove from the target. */
  assignableRoles: Role[]
  target?: Member
}

/** What the signed-in user may do to `targetId` in this server. The database re-checks all of it. */
export function useModerationAbilities(serverId: string, targetId: string | null): ModerationAbilities {
  const userId = useUserId()
  const { data: server } = useServer(serverId)
  const { data: roles } = useRoles(serverId)
  const { data: members } = useMembers(serverId)
  const { permissions, topPosition, isOwner } = useServerPermissions(serverId)

  return useMemo(() => {
    const target = members?.find((m) => m.user_id === targetId)
    const none: ModerationAbilities = {
      outranks: false,
      canKick: false,
      canBan: false,
      canTimeout: false,
      canManageRoles: false,
      assignableRoles: [],
      target,
    }
    if (!server || !roles || !targetId) return none

    const targetIsOwner = server.owner_id === targetId
    const targetTop = target
      ? topRolePosition({ userId: targetId, ownerId: server.owner_id, roles, memberRoleIds: target.role_ids })
      : 0
    const outranks = targetId !== userId && !targetIsOwner && (isOwner || topPosition > targetTop)
    const can = (bit: number) => hasPermission(permissions, bit)
    const canManageRoles = can(Permission.MANAGE_ROLES) && (outranks || targetId === userId)

    return {
      outranks,
      canKick: outranks && can(Permission.KICK_MEMBERS),
      canBan: outranks && can(Permission.BAN_MEMBERS),
      canTimeout: outranks && can(Permission.MODERATE_MEMBERS),
      canManageRoles,
      assignableRoles: canManageRoles
        ? roles.filter((r) => !r.is_default && (isOwner || r.position < topPosition))
        : [],
      target,
    }
  }, [server, roles, members, targetId, userId, permissions, topPosition, isOwner])
}

export const TIMEOUT_OPTIONS = [
  { label: "60 seconds", seconds: 60 },
  { label: "5 minutes", seconds: 5 * 60 },
  { label: "10 minutes", seconds: 10 * 60 },
  { label: "1 hour", seconds: 60 * 60 },
  { label: "1 day", seconds: 24 * 60 * 60 },
  { label: "1 week", seconds: 7 * 24 * 60 * 60 },
]

export const BAN_DELETE_OPTIONS = [
  { label: "Don't delete any", seconds: 0 },
  { label: "Previous hour", seconds: 60 * 60 },
  { label: "Previous 24 hours", seconds: 24 * 60 * 60 },
  { label: "Previous 7 days", seconds: 7 * 24 * 60 * 60 },
]

export function isTimedOut(member: Pick<Member, "timeout_until"> | undefined): boolean {
  return Boolean(member?.timeout_until && new Date(member.timeout_until) > new Date())
}
