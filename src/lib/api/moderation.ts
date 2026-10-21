import type { PostgrestError } from "@supabase/supabase-js"

import { getSupabase } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/database.types"

import { toApiError, unwrap } from "./errors"
import type { Role } from "./members"

async function rpc<T = void>(
  promise: PromiseLike<{ data: unknown; error: PostgrestError | null }>
): Promise<T> {
  const { data, error } = await promise
  if (error) throw toApiError(error)
  return data as T
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export type RolePatch = {
  name?: string
  color?: string | null
  permissions?: number
  hoist?: boolean
  mentionable?: boolean
}

export function createRole(serverId: string, input: { name: string; color?: string | null; permissions?: number }) {
  return rpc<Role>(
    getSupabase().rpc("create_role", {
      p_server: serverId,
      p_name: input.name,
      p_color: input.color ?? undefined,
      p_permissions: input.permissions ?? 0,
    })
  )
}

export function updateRole(roleId: string, patch: RolePatch) {
  return rpc<Role>(
    getSupabase().rpc("update_role", {
      p_role: roleId,
      p_name: patch.name,
      p_color: patch.color ?? undefined,
      p_clear_color: patch.color === null,
      p_permissions: patch.permissions,
      p_hoist: patch.hoist,
      p_mentionable: patch.mentionable,
    })
  )
}

export function deleteRole(roleId: string) {
  return rpc(getSupabase().rpc("delete_role", { p_role: roleId }))
}

/** `roleIds`: every non-default role, highest first. */
export function reorderRoles(serverId: string, roleIds: string[]) {
  return rpc(getSupabase().rpc("reorder_roles", { p_server: serverId, p_role_ids: roleIds }))
}

export function setMemberRoles(serverId: string, userId: string, roleIds: string[]) {
  return rpc(
    getSupabase().rpc("set_member_roles", { p_server: serverId, p_user: userId, p_role_ids: roleIds })
  )
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

export function kickMember(serverId: string, userId: string) {
  return rpc(getSupabase().rpc("kick_member", { p_server: serverId, p_user: userId }))
}

export function banMember(serverId: string, userId: string, reason: string, deleteSeconds: number) {
  return rpc(
    getSupabase().rpc("ban_member", {
      p_server: serverId,
      p_user: userId,
      p_reason: reason || undefined,
      p_delete_seconds: deleteSeconds,
    })
  )
}

export function unbanMember(serverId: string, userId: string) {
  return rpc(getSupabase().rpc("unban_member", { p_server: serverId, p_user: userId }))
}

/** `until` null removes the timeout (the RPC treats any past time as "no timeout"). */
export function timeoutMember(serverId: string, userId: string, until: Date | null) {
  return rpc(
    getSupabase().rpc("timeout_member", {
      p_server: serverId,
      p_user: userId,
      p_until: (until ?? new Date(0)).toISOString(),
    })
  )
}

export type Ban = Tables<"bans"> & {
  user: Pick<Tables<"profiles">, "id" | "username" | "display_name" | "avatar_url"> | null
}

export async function listBans(serverId: string): Promise<Ban[]> {
  return unwrap(
    await getSupabase()
      .from("bans")
      .select("*, user:profiles!bans_user_id_fkey(id, username, display_name, avatar_url)")
      .eq("server_id", serverId)
      .order("created_at", { ascending: false })
      .returns<Ban[]>()
  )
}

// ---------------------------------------------------------------------------
// Private channels
// ---------------------------------------------------------------------------

export async function listChannelAccess(channelId: string): Promise<string[]> {
  const rows = unwrap(
    await getSupabase().from("channel_role_access").select("role_id").eq("channel_id", channelId)
  )
  return rows.map((r) => r.role_id)
}

export function setChannelAccess(channelId: string, isPrivate: boolean, roleIds: string[]) {
  return rpc(
    getSupabase().rpc("set_channel_access", {
      p_channel: channelId,
      p_private: isPrivate,
      p_role_ids: roleIds,
    })
  )
}
