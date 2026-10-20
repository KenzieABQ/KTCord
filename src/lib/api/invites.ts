import { getSupabase } from "@/lib/supabase/client"
import type { Database, Tables } from "@/lib/supabase/database.types"

import { toApiError, unwrap } from "./errors"

export type Invite = Tables<"invites">
export type InvitePreview = Database["public"]["Functions"]["get_invite"]["Returns"][number]

export async function createInvite(
  serverId: string,
  options: { maxAgeSeconds: number | null; maxUses: number | null }
): Promise<Invite> {
  const { data, error } = await getSupabase().rpc("create_invite", {
    p_server: serverId,
    // 0 means "never expires" to the RPC.
    p_max_age_seconds: options.maxAgeSeconds ?? 0,
    p_max_uses: options.maxUses ?? undefined,
  })
  if (error) throw toApiError(error)
  return data
}

export async function getInvitePreview(code: string): Promise<InvitePreview | null> {
  const { data, error } = await getSupabase().rpc("get_invite", { p_code: code })
  if (error) throw toApiError(error)
  return data[0] ?? null
}

export async function joinServerByInvite(code: string): Promise<string> {
  const { data, error } = await getSupabase().rpc("join_server_by_invite", { p_code: code })
  if (error) throw toApiError(error)
  return data
}

export async function listInvites(serverId: string): Promise<Invite[]> {
  return unwrap(
    await getSupabase()
      .from("invites")
      .select("*")
      .eq("server_id", serverId)
      .order("created_at", { ascending: false })
  )
}

export async function revokeInvite(code: string): Promise<void> {
  const { error } = await getSupabase().from("invites").delete().eq("code", code)
  if (error) throw toApiError(error)
}

/** Accepts a bare code or any URL ending in /invite/CODE. */
export function parseInviteCode(input: string): string | null {
  const trimmed = input.trim()
  const match = trimmed.match(/(?:\/invite\/)?([A-Za-z0-9]{8})\/?$/)
  return match ? match[1] : null
}

export function inviteUrl(code: string): string {
  return `${window.location.origin}/invite/${code}`
}
