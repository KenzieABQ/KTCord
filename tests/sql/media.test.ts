import { randomUUID } from "node:crypto"

import type { PGlite } from "@electric-sql/pglite"
import { beforeAll, describe, expect, it } from "vitest"

import { as, createDb, failure, rows, signUp } from "./harness"

/** Milestone 7: attachments, reactions, threads, pins and search under RLS. */
describe("media, reactions, threads, pins, search (PGlite)", () => {
  let db: PGlite
  let owner: string
  let member: string
  let outsider: string
  let serverId: string
  let general: string
  let everyoneRole: string

  const one = async <T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) =>
    as(db, user, async () => (await rows<T>(db, sql, params))[0])
  const send = (user: string, channel: string, content: string, attachments: unknown[] = [], id = randomUUID()) =>
    one<{ id: string }>(user, "select * from send_message($1, $2, $3, null, $4::jsonb)", [
      id,
      channel,
      content,
      JSON.stringify(attachments),
    ])

  beforeAll(async () => {
    db = await createDb()
    ;[owner, member, outsider] = await Promise.all(["owner", "member", "outsider"].map((u) => signUp(db, u)))
    ;({ id: serverId } = await one<{ id: string }>(owner, "select create_server('Media') as id"))
    const { code } = await one<{ code: string }>(owner, "select code from create_invite($1)", [serverId])
    await one(member, "select join_server_by_invite($1)", [code])
    general = (await rows<{ id: string }>(db, "select id from channels where server_id = $1 and name = 'general'", [serverId]))[0].id
    everyoneRole = (await rows<{ id: string }>(db, "select id from roles where server_id = $1 and is_default", [serverId]))[0].id
  }, 60_000)

  describe("attachments", () => {
    it("accepts files stored under the message's own folder and flags them for search", async () => {
      const id = randomUUID()
      await send(member, general, "look", [
        { path: `${general}/${id}/0-cat.png`, name: "cat.png", size: 10, mime: "image/png", kind: "image" },
      ], id)
      const [msg] = await rows<{ has_image: boolean; has_file: boolean; has_video: boolean }>(
        db,
        "select has_image, has_file, has_video from messages where id = $1",
        [id]
      )
      expect(msg).toEqual({ has_image: true, has_file: true, has_video: false })
    })

    it("rejects paths outside the message folder and more than 10 files", async () => {
      const id = randomUUID()
      const wrongPath = await as(db, member, () =>
        failure(db, "select * from send_message($1, $2, 'x', null, $3::jsonb)", [
          id,
          general,
          JSON.stringify([{ path: `${general}/someone-else/0-a.png`, kind: "image" }]),
        ])
      )
      expect(wrongPath).toMatch(/don't belong/)
      const many = Array.from({ length: 11 }, (_, i) => ({ path: `${general}/${id}/${i}`, kind: "file" }))
      const tooMany = await as(db, member, () =>
        failure(db, "select * from send_message($1, $2, 'x', null, $3::jsonb)", [id, general, JSON.stringify(many)])
      )
      expect(tooMany).toMatch(/up to 10/)
    })

    it("needs Attach Files, and limits storage access to channel viewers", async () => {
      await db.query("update roles set permissions = permissions & ~4096 where id = $1", [everyoneRole])
      const id = randomUUID()
      const error = await as(db, member, () =>
        failure(db, "select * from send_message($1, $2, 'x', null, $3::jsonb)", [
          id,
          general,
          JSON.stringify([{ path: `${general}/${id}/0-a.txt`, kind: "file" }]),
        ])
      )
      expect(error).toMatch(/attach files/)
      await db.query("update roles set permissions = permissions | 4096 where id = $1", [everyoneRole])

      await db.query("insert into storage.objects (bucket_id, name) values ('attachments', $1)", [`${general}/x/0-a.png`])
      const seen = (user: string) => as(db, user, () => rows(db, "select name from storage.objects where bucket_id = 'attachments'"))
      expect(await seen(member)).toHaveLength(1)
      expect(await seen(outsider)).toHaveLength(0)
    })
  })

  describe("reactions", () => {
    let msg: string

    beforeAll(async () => {
      ;({ id: msg } = await send(owner, general, "react to me"))
    })

    it("lets members react and see reactions; outsiders can't", async () => {
      await as(db, member, () => db.query("insert into reactions (message_id, emoji) values ($1, '🔥')", [msg]))
      const [r] = await rows<{ channel_id: string; user_id: string }>(db, "select channel_id, user_id from reactions where message_id = $1", [msg])
      expect(r).toEqual({ channel_id: general, user_id: member })
      expect(await as(db, outsider, () => rows(db, "select id from reactions where message_id = $1", [msg]))).toEqual([])
      expect(await as(db, outsider, () => failure(db, "insert into reactions (message_id, emoji) values ($1, '👍')", [msg]))).toMatch(/row-level security/)
    })

    it("needs Add Reactions for new emoji, but anyone can join an existing one", async () => {
      await db.query("update roles set permissions = permissions & ~8192 where id = $1", [everyoneRole])
      expect(await as(db, member, () => failure(db, "insert into reactions (message_id, emoji) values ($1, '🎉')", [msg]))).toMatch(/row-level security/)
      await as(db, owner, () => db.query("insert into reactions (message_id, emoji) values ($1, '🔥')", [msg]))
      await db.query("update roles set permissions = permissions | 8192 where id = $1", [everyoneRole])
      const [{ n }] = await rows<{ n: number }>(db, "select count(*)::int as n from reactions where message_id = $1 and emoji = '🔥'", [msg])
      expect(n).toBe(2)
    })

    it("only removes your own reaction unless you can manage messages", async () => {
      await as(db, member, () => db.query("delete from reactions where message_id = $1 and user_id = $2", [msg, owner]))
      const [{ n }] = await rows<{ n: number }>(db, "select count(*)::int as n from reactions where message_id = $1", [msg])
      expect(n).toBe(2)
    })
  })

  describe("threads", () => {
    it("creates a thread once per message, with a note in the parent channel", async () => {
      const { id: starter } = await send(member, general, "let's discuss the roadmap here please")
      const { id: thread } = await one<{ id: string }>(member, "select create_thread($1, '') as id", [starter])
      const again = await one<{ id: string }>(owner, "select create_thread($1, 'other') as id", [starter])
      expect(again.id).toBe(thread)

      const [t] = await rows<{ name: string; parent_id: string; type: string }>(db, "select name, parent_id, type from channels where id = $1", [thread])
      expect(t).toMatchObject({ type: "thread", parent_id: general, name: "let's discuss the roadmap here please" })
      const notes = await rows(db, "select id from messages where channel_id = $1 and type = 'thread_created' and reply_to_id = $2", [general, starter])
      expect(notes).toHaveLength(1)

      await send(owner, thread, "first reply")
      expect(await as(db, member, () => rows(db, "select id from messages where channel_id = $1", [thread]))).toHaveLength(1)
    })

    it("follows the parent channel's privacy", async () => {
      const [{ id: secret }] = await as(db, owner, () =>
        rows<{ id: string }>(db, "insert into channels (server_id, type, name) values ($1, 'text', 'staff') returning id", [serverId])
      )
      const { id: starter } = await send(owner, secret, "staff only")
      const { id: thread } = await one<{ id: string }>(owner, "select create_thread($1, 'plans') as id", [starter])
      await one(owner, "select set_channel_access($1, true, '{}')", [secret])

      expect(await as(db, member, () => rows(db, "select id from channels where id = $1", [thread]))).toEqual([])
      expect(await as(db, member, () => failure(db, "select * from send_message($1, $2, 'sneak')", [randomUUID(), thread]))).toMatch(/permission/)
    })

    it("deletes threads with their parent channel", async () => {
      const [{ id: temp }] = await as(db, owner, () =>
        rows<{ id: string }>(db, "insert into channels (server_id, type, name) values ($1, 'text', 'temp') returning id", [serverId])
      )
      const { id: starter } = await send(owner, temp, "hi")
      const { id: thread } = await one<{ id: string }>(owner, "select create_thread($1, 't') as id", [starter])
      await as(db, owner, () => db.query("delete from channels where id = $1", [temp]))
      expect(await rows(db, "select id from channels where id = $1", [thread])).toEqual([])
    })
  })

  describe("pins", () => {
    it("needs Manage Messages, and posts a pin notice", async () => {
      const { id } = await send(member, general, "pin me")
      expect(await as(db, member, () => failure(db, "select pin_message($1, true)", [id]))).toMatch(/Manage Messages/)
      await one(owner, "select pin_message($1, true)", [id])
      const [msg] = await rows<{ pinned_by: string }>(db, "select pinned_by from messages where id = $1", [id])
      expect(msg.pinned_by).toBe(owner)
      expect(await rows(db, "select id from messages where type = 'pin' and reply_to_id = $1", [id])).toHaveLength(1)

      await one(owner, "select pin_message($1, false)", [id])
      expect((await rows<{ pinned_at: unknown }>(db, "select pinned_at from messages where id = $1", [id]))[0].pinned_at).toBeNull()
    })
  })

  describe("search", () => {
    it("finds by keyword, author and has:, only in visible channels", async () => {
      await send(member, general, "the quarterly roadmap is ready https://example.com/plan")
      const search = (user: string, args: string) =>
        one<{ result: { total: number; messages: { content: string }[] } }>(user, `select search_messages(${args}) as result`)

      const byWord = await search(owner, `p_server => '${serverId}', p_query => 'roadmap'`)
      expect(byWord.result.total).toBeGreaterThanOrEqual(2)

      const withLink = await search(owner, `p_server => '${serverId}', p_query => 'roadmap', p_has => array['link']`)
      expect(withLink.result.messages.map((m) => m.content)).toEqual(["the quarterly roadmap is ready https://example.com/plan"])

      const byAuthor = await search(owner, `p_server => '${serverId}', p_author => '${member}', p_has => array['image']`)
      expect(byAuthor.result.messages.map((m) => m.content)).toEqual(["look"])

      const outsiderView = await search(outsider, `p_query => 'roadmap'`)
      expect(outsiderView.result.total).toBe(0)

      const memberView = await search(member, `p_query => 'staff'`)
      expect(memberView.result.total).toBe(0) // private channel
    })
  })
})
