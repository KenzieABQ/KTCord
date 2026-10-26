import type { PostgrestError } from "@supabase/supabase-js"

import { getSupabase } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/database.types"

import { ApiError, toApiError, unwrap } from "./errors"
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

// ---------------------------------------------------------------------------
// Voice moderation
// ---------------------------------------------------------------------------

export type VoiceModeration = Tables<"voice_moderation">

export async function listVoiceModeration(serverId: string): Promise<VoiceModeration[]> {
  return unwrap(await getSupabase().from("voice_moderation").select("*").eq("server_id", serverId))
}

export function setVoiceModeration(serverId: string, userId: string, state: { mute: boolean; deaf: boolean }) {
  return rpc(
    getSupabase().rpc("set_voice_moderation", { p_server: serverId, p_user: userId, p_mute: state.mute, p_deaf: state.deaf })
  )
}

/**
 * Applies a voice moderation action on the voice server (/api/voice/moderate), which checks
 * the caller's permission in the database first. "removed" is for after a kick, ban or timeout.
 */
export async function moderateVoice(serverId: string, userId: string, action: "disconnect" | "removed" | "sync") {
  const response = await fetch("/api/voice/moderate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ serverId, userId, action }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string }
    throw new ApiError(body.message ?? "Couldn't update voice. Try again.")
  }
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export type AuditEntry = Tables<"audit_log"> & {
  actor: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null
}

export const AUDIT_PAGE_SIZE = 50

/** Newest first; pass the last entry's created_at as `before` for the next page. */
export async function listAuditLog(
  serverId: string,
  filter: { before?: string; actorId?: string; action?: string } = {}
): Promise<AuditEntry[]> {
  let query = getSupabase()
    .from("audit_log")
    .select("*, actor:profiles!audit_log_actor_id_fkey(id, username, display_name, avatar_url)")
    .eq("server_id", serverId)
    .order("created_at", { ascending: false })
    .limit(AUDIT_PAGE_SIZE)
  if (filter.before) query = query.lt("created_at", filter.before)
  if (filter.actorId) query = query.eq("actor_id", filter.actorId)
  if (filter.action) query = query.like("action", `${filter.action}%`)
  return unwrap(await query)
}

// ---------------------------------------------------------------------------
// AutoMod
// ---------------------------------------------------------------------------

export type AutomodRule = Tables<"automod_rules">
export type AutomodRuleInput = Pick<
  AutomodRule,
  "name" | "kind" | "enabled" | "keywords" | "allow_list" | "mention_limit" | "exempt_role_ids"
>

export async function listAutomodRules(serverId: string): Promise<AutomodRule[]> {
  return unwrap(await getSupabase().from("automod_rules").select("*").eq("server_id", serverId).order("created_at"))
}

export async function createAutomodRule(serverId: string, userId: string, input: AutomodRuleInput): Promise<AutomodRule> {
  return unwrap(
    await getSupabase()
      .from("automod_rules")
      .insert({ ...input, server_id: serverId, created_by: userId })
      .select("*")
      .single()
  )
}

export async function updateAutomodRule(id: string, patch: Partial<AutomodRuleInput>): Promise<AutomodRule> {
  return unwrap(await getSupabase().from("automod_rules").update(patch).eq("id", id).select("*").single())
}

export async function deleteAutomodRule(id: string) {
  unwrap(await getSupabase().from("automod_rules").delete().eq("id", id).select("id"))
}
