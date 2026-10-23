import { getSupabase } from "@/lib/supabase/client"
import type { Tables, TablesUpdate } from "@/lib/supabase/database.types"

import { toApiError, unwrap } from "./errors"

export type Channel = Tables<"channels">
export type ServerChannelType = "text" | "voice" | "category"

export async function listChannels(serverId: string): Promise<Channel[]> {
  return unwrap(
    await getSupabase()
      .from("channels")
      .select("*")
      .eq("server_id", serverId)
      .in("type", ["text", "voice", "category"])
      .order("position", { ascending: true })
  )
}

export async function createChannel(input: {
  serverId: string
  type: ServerChannelType
  name: string
  parentId?: string | null
}): Promise<Channel> {
  return unwrap(
    await getSupabase()
      .from("channels")
      .insert({
        server_id: input.serverId,
        type: input.type,
        name: input.name,
        parent_id: input.type === "category" ? null : (input.parentId ?? null),
      })
      .select("*")
      .single()
  )
}

export async function updateChannel(
  channelId: string,
  patch: Pick<TablesUpdate<"channels">, "name" | "topic" | "parent_id" | "is_private" | "slowmode_seconds">
): Promise<Channel> {
  return unwrap(
    await getSupabase().from("channels").update(patch).eq("id", channelId).select("*").single()
  )
}

export async function deleteChannel(channelId: string): Promise<void> {
  const { error } = await getSupabase().from("channels").delete().eq("id", channelId)
  if (error) throw toApiError(error)
}

export type ChannelPlacement = { id: string; position: number; parent_id: string | null }

export async function reorderChannels(serverId: string, items: ChannelPlacement[]): Promise<void> {
  const { error } = await getSupabase().rpc("reorder_channels", {
    p_server: serverId,
    p_items: items,
  })
  if (error) throw toApiError(error)
}

/** Text channels are lowercase with dashes (the database enforces the same rule). */
export function normalizeTextChannelName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export type ChannelOverwrite = Tables<"channel_overwrites">

/** Permission overrides for every channel of a server that the user can see. */
export async function listChannelOverwrites(serverId: string): Promise<ChannelOverwrite[]> {
  // Filtering through the channel join; only the override's own columns come back.
  return unwrap(
    await getSupabase()
      .from("channel_overwrites")
      .select("id, channel_id, role_id, user_id, allow, deny, channels!inner(server_id)")
      .eq("channels.server_id", serverId)
  ).map((row) => ({
    id: row.id,
    channel_id: row.channel_id,
    role_id: row.role_id,
    user_id: row.user_id,
    allow: row.allow,
    deny: row.deny,
  }))
}

/** Sets a role's or member's override on a channel; allow 0 and deny 0 removes it. */
export async function setChannelOverwrite(input: {
  channelId: string
  roleId?: string | null
  userId?: string | null
  allow: number
  deny: number
}) {
  const { error } = await getSupabase().rpc("set_channel_overwrite", {
    p_channel: input.channelId,
    // Exactly one target is set; the generated types don't know the other may be null.
    p_role: (input.roleId ?? null) as string,
    p_user: (input.userId ?? null) as string,
    p_allow: input.allow,
    p_deny: input.deny,
  })
  if (error) throw toApiError(error)
}
