/**
 * A second "user" for testing Realtime by hand: signs in as a demo account, shows a typing
 * indicator, then posts a message, on repeat.
 *
 *   npx tsx scripts/bot.ts <channel-id> [--as demo_ben] [--mention <username>] [--every 8] [--count 5]
 *
 * Run `npx tsx scripts/seed-dev.ts` first so the demo accounts exist.
 */
import { randomUUID } from "node:crypto"

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"

import type { Database } from "../src/lib/supabase/database.types"

import { DEMO_PASSWORD, demoEmail } from "./demo-accounts"

config({ path: ".env.local", quiet: true })

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const channelId = process.argv[2]
if (!channelId || channelId.startsWith("--")) {
  console.error("Usage: npx tsx scripts/bot.ts <channel-id> [--as demo_ben] [--mention user] [--every 8] [--count 5]")
  process.exit(1)
}
const as = arg("as", "demo_ben")!
const every = Number(arg("every", "8")) * 1000
const count = Number(arg("count", "5"))
const mention = arg("mention")

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false } }
)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const { data: auth, error } = await supabase.auth.signInWithPassword({
    email: demoEmail(as),
    password: DEMO_PASSWORD,
  })
  if (error) throw error
  const userId = auth.user.id

  let mentionId: string | null = null
  if (mention) {
    const { data } = await supabase.from("profiles").select("id").eq("username", mention).single()
    mentionId = data?.id ?? null
  }

  await supabase.realtime.setAuth()
  const topic = supabase.channel(`channel:${channelId}`, { config: { private: true } })
  await new Promise<void>((resolve, reject) =>
    topic.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve()
      if (status === "CHANNEL_ERROR") reject(new Error("Couldn't join the typing topic (check RLS on realtime.messages)."))
    })
  )

  for (let i = 1; i <= count; i++) {
    for (let t = 0; t < 2; t++) {
      await topic.send({ type: "broadcast", event: "typing", payload: { userId } })
      await sleep(2500)
    }
    const content = `${mentionId && i % 2 === 1 ? `<@${mentionId}> ` : ""}bot message ${i} of ${count} at ${new Date().toLocaleTimeString()}`
    const { error: sendError } = await supabase.rpc("send_message", {
      p_id: randomUUID(),
      p_channel: channelId,
      p_content: content,
    })
    if (sendError) throw sendError
    console.log(`sent: ${content}`)
    if (i < count) await sleep(Math.max(0, every - 5000))
  }

  await supabase.removeChannel(topic)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
