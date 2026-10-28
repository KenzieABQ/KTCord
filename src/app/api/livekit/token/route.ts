import { z } from "zod"

import { createVoiceToken, liveKitConfig, voiceRoomName } from "@/lib/livekit/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const SPEAK = 1 << 15
const VIDEO = 1 << 18

const Body = z.object({ channelId: z.uuid() })

const noStore = { "Cache-Control": "no-store" }
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: noStore })

/**
 * POST { channelId } → { configured: true, token, url, canSpeak, canVideo } for joining that voice
 * channel's LiveKit room. The database decides who may connect (can_join_voice: CONNECT,
 * not timed out, can see it). { configured: false } means no voice server is set up, so
 * voice works as presence only.
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail(400, "bad_request")
  const { channelId } = parsed.data

  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getClaims()
  const userId = auth?.claims.sub
  if (!userId) return fail(401, "unauthenticated")

  const [{ data: allowed, error: joinError }, { data: permissions }, { data: profile }, { data: channel }] = await Promise.all([
    supabase.rpc("can_join_voice", { p_channel: channelId }),
    supabase.rpc("channel_permissions", { p_channel: channelId }),
    supabase.from("profiles").select("username, display_name").eq("id", userId).maybeSingle(),
    supabase.from("channels").select("server_id").eq("id", channelId).maybeSingle(),
  ])
  if (joinError) return fail(500, "check_failed")
  if (!allowed || !channel?.server_id) return fail(403, "forbidden")
  const { data: moderation } = await supabase
    .from("voice_moderation")
    .select("server_mute, server_deaf")
    .eq("server_id", channel.server_id)
    .eq("user_id", userId)
    .maybeSingle()

  const config = liveKitConfig()
  if (!config) return Response.json({ configured: false }, { headers: noStore })

  // Server mute and deafen stick until a moderator lifts them, as in Discord.
  const canSpeak = ((permissions ?? 0) & SPEAK) !== 0 && !moderation?.server_mute
  const canHear = !moderation?.server_deaf
  const canVideo = ((permissions ?? 0) & VIDEO) !== 0
  const token = await createVoiceToken({
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    userId,
    name: profile?.display_name || profile?.username || "KTCord user",
    room: voiceRoomName(channel.server_id, channelId),
    canSpeak,
    canVideo,
    canHear,
  })
  return Response.json({ configured: true, token, url: config.url, canSpeak, canVideo }, { headers: noStore })
}
