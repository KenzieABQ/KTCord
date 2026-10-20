import { randomUUID } from "node:crypto"

import type { PGlite } from "@electric-sql/pglite"
import { beforeAll, describe, expect, it } from "vitest"

import { as, createDb, failure, rows, signUp } from "./harness"

/**
 * Applies every migration to PGlite and walks through the permission rules end to end,
 * running each step as the right user under RLS. No network or Supabase project needed.
 */
describe("migrations (PGlite)", () => {
  let db: PGlite
  let owner: string
  let mod: string
  let member: string
  let outsider: string
  let serverId: string
  let generalId: string

  const rpc1 = async <T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) =>
    as(db, user, async () => (await rows<T>(db, sql, params))[0])

  beforeAll(async () => {
    db = await createDb()
    owner = await signUp(db, "owner")
    mod = await signUp(db, "mod")
    member = await signUp(db, "member")
    outsider = await signUp(db, "outsider")
  }, 60_000)

  describe("M1 profiles", () => {
    it("creates a profile per signup and normalizes bad usernames", async () => {
      const weird = await signUp(db, "Bad Name!")
      const [profile] = await rows<{ username: string }>(db, "select username from profiles where id = $1", [weird])
      expect(profile.username).toMatch(/^user[0-9a-f]{8}$/)
    })

    it("lets users edit only their own profile", async () => {
      await as(db, member, () => db.query("update profiles set bio = 'hi' where id = $1", [owner]))
      const [ownerProfile] = await rows<{ bio: string }>(db, "select bio from profiles where id = $1", [owner])
      expect(ownerProfile.bio).toBe("")
    })

    it("reports username availability, even to signed-out visitors", async () => {
      const taken = await rpc1<{ available: boolean }>(null, "select username_available('owner') as available")
      const free = await rpc1<{ available: boolean }>(null, "select username_available('nobody_yet') as available")
      expect(taken.available).toBe(false)
      expect(free.available).toBe(true)
    })
  })

  describe("M2 servers and invites", () => {
    it("creates a server with the default structure", async () => {
      ;({ id: serverId } = await rpc1<{ id: string }>(owner, "select create_server('Test Server') as id"))
      const channels = await as(db, owner, () =>
        rows<{ type: string; name: string }>(db, "select type, name from channels where server_id = $1 order by position", [serverId])
      )
      expect(channels.map((c) => `${c.type}:${c.name}`)).toEqual([
        "category:Text Channels",
        "text:general",
        "category:Voice Channels",
        "voice:General",
      ])
      generalId = (await rows<{ id: string }>(db, "select id from channels where server_id = $1 and name = 'general'", [serverId]))[0].id
    })

    it("hides the server from outsiders", async () => {
      const seen = await as(db, outsider, () => rows(db, "select id from servers where id = $1", [serverId]))
      expect(seen).toEqual([])
    })

    it("joins by invite and enforces max uses", async () => {
      const invite = await rpc1<{ code: string }>(owner, "select * from create_invite($1, 3600, 2)", [serverId])
      const preview = await rpc1<{ server_name: string; is_valid: boolean }>(null, "select * from get_invite($1)", [invite.code])
      expect(preview).toMatchObject({ server_name: "Test Server", is_valid: true })

      await rpc1(mod, "select join_server_by_invite($1)", [invite.code])
      await rpc1(member, "select join_server_by_invite($1)", [invite.code])
      const error = await as(db, outsider, () => failure(db, "select join_server_by_invite($1)", [invite.code]))
      expect(error).toMatch(/maximum number of uses/)
    })

    it("normalizes text channel names and blocks non-managers", async () => {
      const [created] = await as(db, owner, () =>
        rows<{ name: string }>(db, "insert into channels (server_id, type, name) values ($1, 'text', ' Off  Topic ') returning name", [serverId])
      )
      expect(created.name).toBe("off-topic")
      const error = await as(db, member, () =>
        failure(db, "insert into channels (server_id, type, name) values ($1, 'text', 'nope')", [serverId])
      )
      expect(error).toMatch(/row-level security/)
    })

    it("reorders channels only with Manage Channels", async () => {
      const error = await as(db, member, () => failure(db, "select reorder_channels($1, '[]'::jsonb)", [serverId]))
      expect(error).toMatch(/permission/)
      await rpc1(owner, "select reorder_channels($1, $2::jsonb)", [serverId, JSON.stringify([{ id: generalId, position: 0, parent_id: null }])])
      const [general] = await rows<{ position: number; parent_id: string | null }>(db, "select position, parent_id from channels where id = $1", [generalId])
      expect(general).toEqual({ position: 0, parent_id: null })
    })
  })

  describe("M3 messages", () => {
    it("sends idempotently with server-side time and author", async () => {
      const id = randomUUID()
      const sql = "select * from send_message($1, $2, $3)"
      const first = await rpc1<{ author_id: string; created_at: Date }>(member, sql, [id, generalId, `hi <@${owner}> @everyone`])
      const again = await rpc1<{ created_at: Date }>(member, sql, [id, generalId, "different"])
      expect(first.author_id).toBe(member)
      expect(again.created_at).toEqual(first.created_at)

      const [stored] = await rows<{ mentions: string[]; mention_everyone: boolean; content: string }>(
        db,
        "select mentions, mention_everyone, content from messages where id = $1",
        [id]
      )
      expect(stored.mentions).toEqual([owner])
      expect(stored.mention_everyone).toBe(false) // no MENTION_EVERYONE by default
      expect(stored.content).toContain("hi")
    })

    it("keeps outsiders out of the feed", async () => {
      const seen = await as(db, outsider, () => rows(db, "select id from messages where channel_id = $1", [generalId]))
      expect(seen).toEqual([])
      const error = await as(db, outsider, () =>
        failure(db, "select * from send_message($1, $2, 'x')", [randomUUID(), generalId])
      )
      expect(error).toMatch(/permission/)
    })

    it("lets authors edit and blocks others", async () => {
      const id = randomUUID()
      await rpc1(member, "select * from send_message($1, $2, 'typo')", [id, generalId])
      await as(db, member, () => db.query("update messages set content = 'fixed', author_id = $2 where id = $1", [id, owner]))
      await as(db, owner, () => db.query("update messages set content = 'owned' where id = $1", [id]))
      const [msg] = await rows<{ content: string; author_id: string; edited_at: Date | null }>(
        db,
        "select content, author_id, edited_at from messages where id = $1",
        [id]
      )
      expect(msg).toMatchObject({ content: "fixed", author_id: member })
      expect(msg.edited_at).not.toBeNull()
    })

    it("tracks unread mentions and clears them on mark_read", async () => {
      const id = randomUUID()
      await rpc1(member, "select * from send_message($1, $2, $3)", [id, generalId, `ping <@${owner}>`])
      const before = await as(db, owner, () =>
        rows<{ channel_id: string; mention_count: string }>(db, "select * from get_unread_state()")
      )
      expect(Number(before.find((r) => r.channel_id === generalId)?.mention_count)).toBeGreaterThan(0)

      await rpc1(owner, "select mark_read($1, $2)", [generalId, id])
      const after = await as(db, owner, () =>
        rows<{ channel_id: string; mention_count: string }>(db, "select * from get_unread_state()")
      )
      expect(Number(after.find((r) => r.channel_id === generalId)?.mention_count)).toBe(0)
    })

    it("authorizes private Realtime topics per channel", async () => {
      const check = (user: string) =>
        as(db, user, async () => {
          await db.query("select set_config('realtime.topic', $1, false)", [`channel:${generalId}`])
          return rows(db, "select 1 from realtime.messages")
        })
      await db.query("insert into realtime.messages (topic) values ($1)", [`channel:${generalId}`])
      expect(await check(member)).toHaveLength(1)
      expect(await check(outsider)).toHaveLength(0)
    })
  })

  describe("M4 roles and moderation", () => {
    let modRole: string
    let helperRole: string

    it("creates roles at the bottom and reorders them", async () => {
      ;({ id: helperRole } = await rpc1<{ id: string }>(owner, "select id from create_role($1, 'Helper')", [serverId]))
      ;({ id: modRole } = await rpc1<{ id: string }>(owner, "select id from create_role($1, 'Moderator', null, $2)", [serverId, 32 | 128 | 2048 | 4]))
      await rpc1(owner, "select reorder_roles($1, $2)", [serverId, [modRole, helperRole]])
      await rpc1(owner, "select set_member_roles($1, $2, $3)", [serverId, mod, [modRole]])
      const order = await rows<{ name: string }>(db, "select name from roles where server_id = $1 order by position desc", [serverId])
      expect(order.map((r) => r.name)).toEqual(["Moderator", "Helper", "@everyone"])
    })

    it("respects the role hierarchy and blocks privilege escalation", async () => {
      expect(await as(db, mod, () => failure(db, "select set_member_roles($1, $2, $3)", [serverId, member, [modRole]]))).toMatch(/below your highest role/)
      expect(await as(db, mod, () => failure(db, "select update_role($1, p_permissions => 512)", [helperRole]))).toMatch(/can't grant/)
      expect(await as(db, member, () => failure(db, "select kick_member($1, $2)", [serverId, mod]))).toMatch(/permission to kick/)
      expect(await as(db, mod, () => failure(db, "select kick_member($1, $2)", [serverId, owner]))).toMatch(/owner can't be moderated/)

      await rpc1(mod, "select set_member_roles($1, $2, $3)", [serverId, member, [helperRole]])
      const [assigned] = await rows<{ n: number }>(db, "select count(*)::int as n from member_roles where user_id = $1", [member])
      expect(assigned.n).toBe(1)
    })

    it("times out members, which blocks sending", async () => {
      const until = new Date(Date.now() + 10 * 60_000).toISOString()
      await rpc1(mod, "select timeout_member($1, $2, $3)", [serverId, member, until])
      const error = await as(db, member, () => failure(db, "select * from send_message($1, $2, 'hello?')", [randomUUID(), generalId]))
      expect(error).toMatch(/timed out/)
      await rpc1(mod, "select timeout_member($1, $2, null)", [serverId, member])
      await rpc1(member, "select * from send_message($1, $2, 'back')", [randomUUID(), generalId])
    })

    it("makes channels private to chosen roles", async () => {
      const [{ id: secret }] = await as(db, owner, () =>
        rows<{ id: string }>(db, "insert into channels (server_id, type, name) values ($1, 'text', 'helpers') returning id", [serverId])
      )
      await rpc1(owner, "select set_channel_access($1, true, $2)", [secret, [helperRole]])
      expect(await as(db, member, () => rows(db, "select id from channels where id = $1", [secret]))).toHaveLength(1)
      expect(await as(db, mod, () => rows(db, "select id from channels where id = $1", [secret]))).toHaveLength(0)
      expect(await as(db, mod, () => failure(db, "select set_channel_access($1, true, $2)", [secret, [helperRole]]))).toMatch(/manage channels/)
    })

    it("lets Manage Messages delete others' messages", async () => {
      const id = randomUUID()
      await rpc1(member, "select * from send_message($1, $2, 'bye')", [id, generalId])
      await as(db, outsider, () => db.query("delete from messages where id = $1", [id]))
      expect(await rows(db, "select id from messages where id = $1", [id])).toHaveLength(1)
      await as(db, mod, () => db.query("delete from messages where id = $1", [id]))
      expect(await rows(db, "select id from messages where id = $1", [id])).toHaveLength(0)
    })

    it("bans with cleanup and blocks rejoining until unbanned", async () => {
      const id = randomUUID()
      await rpc1(member, "select * from send_message($1, $2, 'last')", [id, generalId])
      await rpc1(owner, "select ban_member($1, $2, 'spam', 3600)", [serverId, member])
      expect(await rows(db, "select id from messages where id = $1", [id])).toHaveLength(0)

      const invite = await rpc1<{ code: string }>(owner, "select * from create_invite($1)", [serverId])
      expect(await as(db, member, () => failure(db, "select join_server_by_invite($1)", [invite.code]))).toMatch(/banned/)
      await rpc1(owner, "select unban_member($1, $2)", [serverId, member])
      await rpc1(member, "select join_server_by_invite($1)", [invite.code])
    })

    it("only lets the owner delete the server, and owners can't leave", async () => {
      expect(await as(db, owner, () => failure(db, "select leave_server($1)", [serverId]))).toMatch(/Owners can't leave/)
      await as(db, mod, () => db.query("delete from servers where id = $1", [serverId]))
      expect(await rows(db, "select id from servers where id = $1", [serverId])).toHaveLength(1)
      await as(db, owner, () => db.query("delete from servers where id = $1", [serverId]))
      expect(await rows(db, "select id from servers where id = $1", [serverId])).toHaveLength(0)
    })
  })
})
