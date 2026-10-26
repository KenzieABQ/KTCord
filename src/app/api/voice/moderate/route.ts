import { z } from "zod"

import { applyVoiceModeration, liveKitConfig, removeFromServerVoice } from "@/lib/livekit/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const Body = z.object({
  serverId: z.uuid(),
  userId: z.uuid(),
  /**
   * disconnect: a moderator kicks someone out of voice (checked and logged by the database).
   * removed: after a kick, ban or timeout, pull them out of any voice room they're still in.
   * sync: apply the current server mute/deafen to a room they're already in.
   */
  action: z.enum(["disconnect", "removed", "sync"]),
})

const noStore = { "Cache-Control": "no-store" }
const reply = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: noStore })

/**
 * Voice moderation on the LiveKit side. Every action is authorized by the database with the
 * caller's session first, so this can only do what the caller is allowed to do.
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return reply(400, { error: "bad_request" })
  const { serverId, userId, action } = parsed.data

  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getClaims()
  if (!auth?.claims.sub) return reply(401, { error: "unauthenticated" })

  if (action === "disconnect") {
    const { error } = await supabase.rpc("voice_disconnect_member", { p_server: serverId, p_user: userId })
    if (error) return reply(403, { error: "forbidden", message: error.message })
  } else if (action === "removed") {
    const { data: allowed } = await supabase.rpc("voice_removal_allowed", { p_server: serverId, p_user: userId })
    if (!allowed) return reply(403, { error: "forbidden" })
  } else {
    const { data: canModerate } = await supabase.rpc("has_server_permission", { p_server: serverId, p_perm: 2048 })
    if (!canModerate) return reply(403, { error: "forbidden" })
  }

  const config = liveKitConfig()
  // Presence-only voice: the person's own app leaves or mutes; there's no room to touch.
  if (!config) return reply(200, { configured: false })

  try {
    if (action === "sync") {
      const { data: state } = await supabase
        .from("voice_moderation")
        .select("server_mute, server_deaf")
        .eq("server_id", serverId)
        .eq("user_id", userId)
        .maybeSingle()
      const { data: perms } = await supabase.rpc("server_permissions", { p_server: serverId, p_user: userId })
      const rooms = await applyVoiceModeration(config, serverId, userId, {
        canPublish: ((perms ?? 0) & (1 << 15)) !== 0 && !state?.server_mute,
        canSubscribe: !state?.server_deaf,
      })
      return reply(200, { configured: true, rooms })
    }
    const rooms = await removeFromServerVoice(config, serverId, userId)
    return reply(200, { configured: true, rooms })
  } catch {
    return reply(502, { error: "voice_server" })
  }
}
