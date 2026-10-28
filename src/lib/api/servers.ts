import { getSupabase } from "@/lib/supabase/client"
import type { Tables, TablesUpdate } from "@/lib/supabase/database.types"

import { toApiError, unwrap } from "./errors"
import { uploadServerIcon } from "./storage"

export type Server = Tables<"servers">

/** A server in the rail, with the id of the user's own membership row (used to spot kicks). */
/** A server you're in; `pending` while you haven't accepted its rules. */
export type JoinedServer = Server & { membership_id: string; joined_at: string; pending: boolean }

export async function listMyServers(userId: string): Promise<JoinedServer[]> {
  const rows = unwrap(
    await getSupabase()
      .from("server_members")
      .select("id, joined_at, pending, server:servers!inner(*)")
      .eq("user_id", userId)
      .order("joined_at", { ascending: true })
  )
  return rows.map((row) => ({
    ...row.server,
    membership_id: row.id,
    joined_at: row.joined_at,
    pending: row.pending,
  }))
}

/** Creates the server (with #general, General voice and both categories), then uploads its icon. */
export async function createServer(name: string, icon: Blob | null): Promise<string> {
  const supabase = getSupabase()
  const { data: serverId, error } = await supabase.rpc("create_server", { p_name: name })
  if (error) throw toApiError(error)
  if (icon) {
    // The icon path needs the new server id, so it's uploaded second. A failure here keeps the server.
    try {
      const iconUrl = await uploadServerIcon(serverId, icon)
      await supabase.from("servers").update({ icon_url: iconUrl }).eq("id", serverId)
    } catch {
      // Non-fatal: the server exists without an icon; it can be set in Server Settings.
    }
  }
  return serverId
}

export async function updateServer(
  serverId: string,
  patch: Pick<
    TablesUpdate<"servers">,
    "name" | "icon_url" | "banner_url" | "description" | "welcome_enabled" | "welcome_channels" | "rules" | "rules_enabled" | "vanity_code"
  >
): Promise<Server> {
  return unwrap(
    await getSupabase().from("servers").update(patch).eq("id", serverId).select("*").single()
  )
}

export async function deleteServer(serverId: string): Promise<void> {
  const { error } = await getSupabase().from("servers").delete().eq("id", serverId)
  if (error) throw toApiError(error)
}

export async function leaveServer(serverId: string): Promise<void> {
  const { error } = await getSupabase().rpc("leave_server", { p_server: serverId })
  if (error) throw toApiError(error)
}

/** Accepts a server's rules, so you can start talking there. */
export async function acceptRules(serverId: string): Promise<void> {
  const { error } = await getSupabase().rpc("accept_rules", { p_server: serverId })
  if (error) throw toApiError(error)
}
