import { randomUUID } from "node:crypto"

import type { PGlite } from "@electric-sql/pglite"
import { beforeAll, describe, expect, it } from "vitest"

import { as, createDb, failure, rows, signUp } from "./harness"

/** Milestones 5 and 6: private settings, notifications, friends and DMs, under RLS. */
describe("presence settings, friends and DMs (PGlite)", () => {
  let db: PGlite
  let ava: string
  let ben: string
  let cy: string
  let stranger: string
  let serverId: string

  const one = async <T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) =>
    as(db, user, async () => (await rows<T>(db, sql, params))[0])

  beforeAll(async () => {
    db = await createDb()
    ;[ava, ben, cy, stranger] = await Promise.all(["ava", "ben", "cy", "stranger"].map((u) => signUp(db, u)))
    ;({ id: serverId } = await one<{ id: string }>(ava, "select create_server('Shared') as id"))
    const { code } = await one<{ code: string }>(ava, "select code from create_invite($1)", [serverId])
    await one(cy, "select join_server_by_invite($1)", [code])
  }, 60_000)

  describe("M5", () => {
    it("keeps the chosen status private", async () => {
      await as(db, ava, () => db.query("update user_settings set status = 'invisible' where user_id = $1", [ava]))
      const own = await as(db, ava, () => rows(db, "select status from user_settings"))
      const others = await as(db, ben, () => rows(db, "select status from user_settings where user_id = $1", [ava]))
      expect(own).toEqual([{ status: "invisible" }])
      expect(others).toEqual([])
      const columns = await rows(db, "select column_name from information_schema.columns where table_name = 'profiles' and column_name = 'status'")
      expect(columns).toEqual([])
    })

    it("stores notification settings per server, and only for members", async () => {
      const saved = await one<{ level: string }>(cy, "select * from set_notification_settings(p_server => $1, p_level => 'nothing')", [serverId])
      expect(saved.level).toBe("nothing")
      const muted = await one<{ level: string; muted_until: unknown }>(
        cy,
        "select * from set_notification_settings(p_server => $1, p_muted_until => 'infinity')",
        [serverId]
      )
      expect(muted.level).toBe("nothing") // unchanged by a mute-only update
      expect(await as(db, stranger, () => failure(db, "select set_notification_settings(p_server => $1, p_level => 'all')", [serverId]))).toMatch(/not a member/)
    })

    it("marks a whole server read", async () => {
      const [{ id: general }] = await rows<{ id: string }>(db, "select id from channels where server_id = $1 and name = 'general'", [serverId])
      await one(ava, "select * from send_message($1, $2, 'hello')", [randomUUID(), general])
      const unread = async () =>
        as(db, cy, () => rows<{ last_message_at: Date; last_read_at: Date }>(db, "select * from get_unread_state() where channel_id = $1", [general]))
      const [before] = await unread()
      expect(before.last_message_at > before.last_read_at).toBe(true)
      await one(cy, "select mark_server_read($1)", [serverId])
      const [after] = await unread()
      expect(after.last_message_at <= after.last_read_at).toBe(true)
    })

    it("authorizes the global presence topic for signed-in users only", async () => {
      await db.query("insert into realtime.messages (topic, extension) values ('presence:global', 'presence')")
      const seen = (user: string | null) =>
        as(db, user, async () => {
          await db.query("select set_config('realtime.topic', 'presence:global', false)")
          return rows(db, "select 1 from realtime.messages where topic = 'presence:global'")
        })
      expect(await seen(ben)).toHaveLength(1)
      expect(await seen(null)).toHaveLength(0)
    })
  })

  describe("M6 friends", () => {
    it("sends, accepts by reverse request, and rejects duplicates", async () => {
      await one(ava, "select * from send_friend_request('ben')")
      expect(await as(db, ava, () => failure(db, "select send_friend_request('ben')"))).toMatch(/already sent/)
      const accepted = await one<{ status: string }>(ben, "select * from send_friend_request('AVA')")
      expect(accepted.status).toBe("accepted")
      expect(await as(db, ava, () => failure(db, "select send_friend_request('ben')"))).toMatch(/already friends/)
      expect(await as(db, ava, () => failure(db, "select send_friend_request('ava')"))).toMatch(/yourself/)
      expect(await as(db, ava, () => failure(db, "select send_friend_request('nobody_here')"))).toMatch(/username is correct/)
    })

    it("lets only the addressee accept, and either side decline", async () => {
      const req = await one<{ id: string }>(cy, "select * from send_friend_request('ava')")
      await one(cy, "select respond_friend_request($1, true)", [req.id]) // requester can't accept
      expect((await rows<{ status: string }>(db, "select status from friendships where id = $1", [req.id]))[0].status).toBe("pending")
      await one(ava, "select respond_friend_request($1, true)", [req.id])
      expect((await rows<{ status: string }>(db, "select status from friendships where id = $1", [req.id]))[0].status).toBe("accepted")
    })

    it("only shows people their own friendships", async () => {
      const strangerSees = await as(db, stranger, () => rows(db, "select id from friendships"))
      expect(strangerSees).toEqual([])
    })
  })

  describe("M6 DMs", () => {
    let dm: string

    it("opens one DM per pair, only with friends or server-mates", async () => {
      ;({ id: dm } = await one<{ id: string }>(ava, "select open_dm($1) as id", [ben]))
      const again = await one<{ id: string }>(ben, "select open_dm($1) as id", [ava])
      expect(again.id).toBe(dm)
      expect(await as(db, stranger, () => failure(db, "select open_dm($1)", [ava]))).toMatch(/friends or people you share a server/)
    })

    it("keeps DM messages between recipients", async () => {
      await one(ava, "select * from send_message($1, $2, 'psst')", [randomUUID(), dm])
      expect(await as(db, ben, () => rows(db, "select id from messages where channel_id = $1", [dm]))).toHaveLength(1)
      expect(await as(db, cy, () => rows(db, "select id from messages where channel_id = $1", [dm]))).toEqual([])
      expect(await as(db, cy, () => failure(db, "select * from send_message($1, $2, 'hi')", [randomUUID(), dm]))).toMatch(/permission/)
    })

    it("counts unread DM messages as mentions", async () => {
      const [row] = await as(db, ben, () =>
        rows<{ mention_count: string; server_id: string | null }>(db, "select * from get_unread_state() where channel_id = $1", [dm])
      )
      expect(row.server_id).toBeNull()
      expect(Number(row.mention_count)).toBe(1)
    })

    it("hides a closed DM until a new message arrives", async () => {
      await one(ben, "select close_dm($1)", [dm])
      const hidden = async () =>
        (await rows<{ hidden: boolean }>(db, "select hidden from channel_recipients where channel_id = $1 and user_id = $2", [dm, ben]))[0].hidden
      expect(await hidden()).toBe(true)
      await one(ava, "select * from send_message($1, $2, 'you there?')", [randomUUID(), dm])
      expect(await hidden()).toBe(false)
    })

    it("builds group DMs from friends, up to 10 people", async () => {
      expect(await as(db, ava, () => failure(db, "select create_group_dm($1)", [[ben, stranger]]))).toMatch(/only add friends/)
      const { id: group } = await one<{ id: string }>(ava, "select create_group_dm($1) as id", [[ben, cy]])
      const members = await as(db, cy, () => rows(db, "select user_id from channel_recipients where channel_id = $1", [group]))
      expect(members).toHaveLength(3)

      await one(cy, "select rename_group_dm($1, ' Weekend Plans ')", [group])
      expect((await rows<{ name: string }>(db, "select name from channels where id = $1", [group]))[0].name).toBe("Weekend Plans")

      await one(ava, "select leave_group_dm($1)", [group])
      const [{ owner_id }] = await rows<{ owner_id: string }>(db, "select owner_id from channels where id = $1", [group])
      expect([ben, cy]).toContain(owner_id)
      expect(await as(db, ava, () => rows(db, "select id from messages where channel_id = $1", [group]))).toEqual([])
    })
  })
})
