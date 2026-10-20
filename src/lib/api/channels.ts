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
  patch: Pick<TablesUpdate<"channels">, "name" | "topic" | "parent_id" | "is_private">
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
