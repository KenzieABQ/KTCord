/**
 * A second "user" for testing voice presence by hand: signs in as a demo account, joins a
 * voice channel's presence topic, and pretends to talk (speaking events on and off) for a while.
 *
 *   npx tsx scripts/voice-bot.ts <voice-channel-id> [--as demo_ben] [--seconds 60] [--muted]
 *
 * Presence only: no audio. Run `npx tsx scripts/seed-dev.ts` first so the demo accounts exist.
 */
import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"

import type { Database } from "../src/lib/supabase/database.types"
import type { SpeakingEvent, VoicePresenceMeta } from "../src/lib/voice/roster"

import { DEMO_PASSWORD, demoEmail } from "./demo-accounts"

config({ path: ".env.local", quiet: true })

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const channelId = process.argv[2]
if (!channelId || channelId.startsWith("--")) {
  console.error("Usage: npx tsx scripts/voice-bot.ts <voice-channel-id> [--as demo_ben] [--seconds 60] [--muted]")
  process.exit(1)
}
const as = arg("as", "demo_ben")!
const seconds = Number(arg("seconds", "60"))
const muted = process.argv.includes("--muted")

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false } }
)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const { data: auth, error } = await supabase.auth.signInWithPassword({ email: demoEmail(as), password: DEMO_PASSWORD })
  if (error) throw error
  const userId = auth.user.id

  await supabase.realtime.setAuth()
  const topic = supabase.channel(`voice:${channelId}`, { config: { private: true, presence: { key: crypto.randomUUID() } } })
  topic.on("presence", { event: "sync" }, () => {
    const metas = Object.values(topic.presenceState()).flat() as unknown as VoicePresenceMeta[]
    console.log(`in channel: ${new Set(metas.map((m) => m.user_id)).size} people`)
  })
  await new Promise<void>((resolve, reject) =>
    topic.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve()
      if (status === "CHANNEL_ERROR") reject(new Error("Couldn't watch this voice channel (check RLS on realtime.messages)."))
    })
  )

  const meta: VoicePresenceMeta = {
    user_id: userId,
    self_mute: muted,
    self_deaf: false,
    joined_at: new Date().toISOString(),
  }
  const joined = await topic.track(meta)
  if (joined !== "ok") throw new Error(`Couldn't join voice: ${joined}`)
  console.log(`${as} joined voice`)

  // Speaking goes out as Broadcast events, like the app does.
  let speaking = false
  const end = Date.now() + seconds * 1000
  while (Date.now() < end) {
    await sleep(2000)
    if (muted) continue
    speaking = !speaking
    const payload: SpeakingEvent = { user_id: userId, speaking }
    await topic.send({ type: "broadcast", event: "speaking", payload })
    console.log(speaking ? "speaking" : "quiet")
  }

  await topic.untrack()
  await supabase.removeChannel(topic)
  console.log(`${as} left voice`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
