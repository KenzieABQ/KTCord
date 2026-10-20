/**
 * Dev seed: three demo users, a "KTCord Lounge" server with roles and channels, and ~500
 * messages spread over the last few days (for pagination, grouping and day dividers).
 *
 *   npx tsx scripts/seed-dev.ts                 # create/refresh demo data
 *   npx tsx scripts/seed-dev.ts --join <user>   # also add your account to the demo server
 *
 * Demo accounts sign in with DEMO_PASSWORD from ./demo-accounts.ts (dev project only).
 */
import { randomUUID } from "node:crypto"

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"

import type { Database } from "../src/lib/supabase/database.types"

import { DEMO_PASSWORD, DEMO_USERS, demoEmail } from "./demo-accounts"

config({ path: ".env.local", quiet: true })

const SERVER_NAME = "KTCord Lounge"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const secret = process.env.SUPABASE_SECRET_KEY!
if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local")
  process.exit(1)
}
const admin = createClient<Database>(url, secret, { auth: { persistSession: false } })

async function ensureUser(u: (typeof DEMO_USERS)[number]): Promise<string> {
  const { data: existing } = await admin.from("profiles").select("id").eq("username", u.username).maybeSingle()
  if (existing) return existing.id
  const { data, error } = await admin.auth.admin.createUser({
    email: demoEmail(u.username),
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { username: u.username, display_name: u.display },
  })
  if (error) throw error
  await admin
    .from("profiles")
    .update({ banner_color: u.banner, bio: u.bio, onboarded_at: new Date().toISOString() })
    .eq("id", data.user.id)
  return data.user.id
}

/** Inserts a friendship unless the pair already has one (the pair is unique in either order). */
async function ensureFriendship(requester: string, addressee: string, status: "pending" | "accepted") {
  const { data } = await admin
    .from("friendships")
    .select("id")
    .or(
      `and(requester_id.eq.${requester},addressee_id.eq.${addressee}),and(requester_id.eq.${addressee},addressee_id.eq.${requester})`
    )
  if (data?.length) return
  const { error } = await admin.from("friendships").insert({
    requester_id: requester,
    addressee_id: addressee,
    status,
    accepted_at: status === "accepted" ? new Date().toISOString() : null,
  })
  if (error) throw error
}

const LINES = [
  "good morning everyone ☀️",
  "has anyone tried the new **dark theme** yet?",
  "lol",
  "that's _exactly_ what I said",
  "check this out https://ktcord.app/blog/launch",
  "`npm run dev` and you're off",
  "||the cake was a lie||",
  "> quoting the docs here\nand replying underneath",
  "brb, coffee",
  "```ts\nconst hello = (name: string) => `hi ${name}`\n```",
  "~~never mind~~ found it",
  "who's up for voice later?",
  "🔥🔥🔥",
  "agreed",
  "this channel is so much nicer with __markdown__",
  "can someone pin that?",
  "ok I'm convinced",
  "gn all 🌙",
]

async function main() {
  const ids = await Promise.all(DEMO_USERS.map(ensureUser))
  const [ava, ben, cy] = ids

  let { data: server } = await admin.from("servers").select("id").eq("name", SERVER_NAME).eq("owner_id", ava).maybeSingle()
  if (!server) {
    // create_server() uses auth.uid(), so sign in as Ava to call it.
    const asAva = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    })
    const { error: signInError } = await asAva.auth.signInWithPassword({
      email: demoEmail("demo_ava"),
      password: DEMO_PASSWORD,
    })
    if (signInError) throw signInError
    const { data: serverId, error } = await asAva.rpc("create_server", { p_name: SERVER_NAME })
    if (error) throw error
    server = { id: serverId }
  }
  const serverId = server.id

  await admin.from("server_members").upsert(
    [ben, cy].map((user_id) => ({ server_id: serverId, user_id })),
    { onConflict: "server_id,user_id", ignoreDuplicates: true }
  )

  // Roles: a hoisted, colored Moderator (manage messages, kick, timeout) for Ben.
  let { data: moderator } = await admin
    .from("roles")
    .select("id")
    .eq("server_id", serverId)
    .eq("name", "Moderator")
    .maybeSingle()
  if (!moderator) {
    const { data, error } = await admin
      .from("roles")
      .insert({
        server_id: serverId,
        name: "Moderator",
        color: "#3ba55c",
        position: 1,
        hoist: true,
        mentionable: true,
        permissions: 4 | 128 | 2048,
      })
      .select("id")
      .single()
    if (error) throw error
    moderator = data
  }
  await admin
    .from("member_roles")
    .upsert(
      { server_id: serverId, user_id: ben, role_id: moderator.id },
      { onConflict: "user_id,role_id", ignoreDuplicates: true }
    )

  const { data: general } = await admin
    .from("channels")
    .select("id")
    .eq("server_id", serverId)
    .eq("type", "text")
    .eq("name", "general")
    .single()
  if (!general) throw new Error("#general is missing")

  const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("channel_id", general.id)
  if ((count ?? 0) < 400) {
    const authors = [ava, ben, cy]
    const start = Date.now() - 3 * 24 * 60 * 60 * 1000
    const rows: Database["public"]["Tables"]["messages"]["Insert"][] = []
    let t = start
    for (let i = 0; i < 500; i++) {
      // Bursts from one author, with gaps between conversations.
      t += Math.random() < 0.15 ? 60 * 60 * 1000 * Math.random() * 3 : 20_000 + Math.random() * 120_000
      const author = authors[Math.floor(i / 3 + Math.random() * 1.3) % 3]
      let content = LINES[Math.floor(Math.random() * LINES.length)]
      if (i % 37 === 0) content = `hey <@${authors[(authors.indexOf(author) + 1) % 3]}>, ${content}`
      rows.push({
        id: randomUUID(),
        channel_id: general.id,
        author_id: author,
        content,
        created_at: new Date(Math.min(t, Date.now() - 60_000)).toISOString(),
      })
    }
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await admin.from("messages").insert(rows.slice(i, i + 100))
      if (error) throw error
    }
    console.log(`Inserted ${rows.length} messages into #general.`)
  }

  // Friends: Ava ↔ Ben are friends; Cy has a pending request to Ava.
  await ensureFriendship(ava, ben, "accepted")
  await ensureFriendship(cy, ava, "pending")

  // A DM between Ava and Ben with a little history.
  const dmKey = [ava, ben].sort().join(":")
  let { data: dm } = await admin.from("channels").select("id").eq("dm_key", dmKey).maybeSingle()
  if (!dm) {
    const { data, error } = await admin.from("channels").insert({ type: "dm", dm_key: dmKey, position: 0 }).select("id").single()
    if (error) throw error
    dm = data
    await admin.from("channel_recipients").insert([
      { channel_id: dm.id, user_id: ava },
      { channel_id: dm.id, user_id: ben },
    ])
    const now = Date.now()
    await admin.from("messages").insert(
      ["did you see the new server?", "yes!! the dark theme is so good", "voice chat when?", "soon™"].map((content, i) => ({
        id: randomUUID(),
        channel_id: dm!.id,
        author_id: i % 2 === 0 ? ava : ben,
        content,
        created_at: new Date(now - (4 - i) * 90_000).toISOString(),
      }))
    )
  }

  const joinIndex = process.argv.indexOf("--join")
  if (joinIndex !== -1) {
    const username = process.argv[joinIndex + 1]
    const { data: me } = await admin.from("profiles").select("id").eq("username", username).single()
    if (!me) throw new Error(`No user named ${username}`)
    await admin
      .from("server_members")
      .upsert({ server_id: serverId, user_id: me.id }, { onConflict: "server_id,user_id", ignoreDuplicates: true })
    // Ava also sends you a friend request, so Friends → Pending has something in it.
    if (me.id !== ava) await ensureFriendship(ava, me.id, "pending")
    console.log(`Added ${username} to ${SERVER_NAME}, with a friend request from demo_ava.`)
  }

  console.log(`Seeded ${SERVER_NAME} (${serverId}). Demo users: ${DEMO_USERS.map((u) => u.username).join(", ")}.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
