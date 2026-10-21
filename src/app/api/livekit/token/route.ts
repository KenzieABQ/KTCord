import { z } from "zod"

import { createVoiceToken, liveKitConfig } from "@/lib/livekit/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const SPEAK = 1 << 15

const Body = z.object({ channelId: z.uuid() })

const noStore = { "Cache-Control": "no-store" }
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: noStore })

/**
 * POST { channelId } → { configured: true, token, url, canSpeak } for joining that voice
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

  const [{ data: allowed, error: joinError }, { data: permissions }, { data: profile }] = await Promise.all([
    supabase.rpc("can_join_voice", { p_channel: channelId }),
    supabase.rpc("channel_permissions", { p_channel: channelId }),
    supabase.from("profiles").select("username, display_name").eq("id", userId).maybeSingle(),
  ])
  if (joinError) return fail(500, "check_failed")
  if (!allowed) return fail(403, "forbidden")

  const config = liveKitConfig()
  if (!config) return Response.json({ configured: false }, { headers: noStore })

  const canSpeak = ((permissions ?? 0) & SPEAK) !== 0
  const token = await createVoiceToken({
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    userId,
    name: profile?.display_name || profile?.username || "KTCord user",
    channelId,
    canSpeak,
  })
  return Response.json({ configured: true, token, url: config.url, canSpeak }, { headers: noStore })
}
