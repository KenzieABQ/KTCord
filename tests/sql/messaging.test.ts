import { randomUUID } from "node:crypto"

import type { PGlite } from "@electric-sql/pglite"
import { beforeAll, describe, expect, it } from "vitest"

import { as, createDb, failure, rows, signUp } from "./harness"

type Msg = {
  id: string
  content: string
  mentions: string[]
  reply_ping: boolean
  forwarded: Record<string, unknown> | null
  poll: { question: string; answers: { id: number; text: string; emoji: string | null }[]; multiselect: boolean; expires_at: string } | null
}

/** Milestone 14: mark unread, reply pings, forwarding and polls. */
describe("messaging extras (PGlite)", () => {
  let db: PGlite
  let ava: string
  let ben: string
  let cy: string
  let general: string
  let elsewhere: string

  const one = async <T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) =>
    as(db, user, async () => (await rows<T>(db, sql, params))[0])
  const send = (
    user: string,
    opts: { channel?: string; content?: string; replyTo?: string; replyPing?: boolean; forward?: string; poll?: unknown }
  ) =>
    one<Msg>(user, "select * from send_message($1, $2, $3, $4, '[]', $5, $6, $7)", [
      randomUUID(),
      opts.channel ?? general,
      opts.content ?? "",
      opts.replyTo ?? null,
      opts.replyPing ?? true,
      opts.forward ?? null,
      opts.poll ?? null,
    ])
  const sendFails = (user: string, poll: unknown) =>
    as(db, user, () => failure(db, "select * from send_message($1, $2, '', null, '[]', true, null, $3)", [randomUUID(), general, poll]))

  beforeAll(async () => {
    db = await createDb()
    ;[ava, ben, cy] = await Promise.all(["ava", "ben", "cy"].map((u) => signUp(db, u)))
    const { id: serverId } = await one<{ id: string }>(ava, "select create_server('Lounge') as id")
    const { code } = await one<{ code: string }>(ava, "select code from create_invite($1)", [serverId])
    await one(ben, "select join_server_by_invite($1)", [code])
    general = (await rows<{ id: string }>(db, "select id from channels where server_id = $1 and name = 'general'", [serverId]))[0].id
    // Cy's own server, which Ava and Ben can't see.
    const { id: cyServer } = await one<{ id: string }>(cy, "select create_server('Private') as id")
    elsewhere = (await rows<{ id: string }>(db, "select id from channels where server_id = $1 and name = 'general'", [cyServer]))[0].id
  }, 60_000)

  describe("mark unread", () => {
    it("moves the read marker back to just before a message, and mark_read moves it forward again", async () => {
      const first = await send(ava, { content: "one" })
      const second = await send(ava, { content: "two" })
      await one(ben, "select mark_read($1, $2)", [general, second.id])
      await one(ben, "select mark_unread($1, $2)", [general, first.id])
      const state = await one<{ last_read_at: string; first_at: string }>(
        ben,
        "select r.last_read_at::text, m.created_at::text as first_at from read_states r, messages m where r.channel_id = $1 and m.id = $2",
        [general, first.id]
      )
      expect(state.last_read_at < state.first_at).toBe(true)
      const unread = await one<{ n: number }>(
        ben,
        "select count(*)::int as n from messages where channel_id = $1 and created_at > (select last_read_at from read_states where channel_id = $1)",
        [general]
      )
      expect(unread.n).toBeGreaterThanOrEqual(2)
      await one(ben, "select mark_read($1, $2)", [general, second.id])
      const after = await one<{ ok: boolean }>(
        ben,
        "select last_read_at >= (select created_at from messages where id = $2) as ok from read_states where channel_id = $1",
        [general, second.id]
      )
      expect(after.ok).toBe(true)
    })
  })

  describe("reply pings", () => {
    it("mentions the replied-to author unless turned off, and never yourself", async () => {
      const original = await send(ava, { content: "question?" })
      expect((await send(ben, { content: "answer", replyTo: original.id })).mentions).toEqual([ava])
      const quiet = await send(ben, { content: "quiet answer", replyTo: original.id, replyPing: false })
      expect(quiet.mentions).toEqual([])
      expect(quiet.reply_ping).toBe(false)
      expect((await send(ava, { content: "self reply", replyTo: original.id })).mentions).toEqual([])
    })

    it("keeps the setting through edits", async () => {
      const original = await send(ava, { content: "hi" })
      const reply = await send(ben, { content: "hey", replyTo: original.id, replyPing: false })
      const edited = await one<Msg>(ben, "update messages set content = 'hey there', reply_ping = true where id = $1 returning *", [reply.id])
      expect(edited.reply_ping).toBe(false)
      expect(edited.mentions).toEqual([])
    })
  })

  describe("forwarding", () => {
    it("snapshots the original message", async () => {
      const original = await send(ava, { content: "worth sharing" })
      const forward = await send(ben, { forward: original.id })
      expect(forward.content).toBe("")
      expect(forward.forwarded).toMatchObject({ message_id: original.id, author_id: ava, content: "worth sharing", channel_id: general })
      // Forwarding a forward passes the original along.
      expect((await send(ava, { forward: forward.id })).forwarded).toMatchObject({ message_id: original.id, author_id: ava })
    })

    it("rebuilds forged snapshots from the real message", async () => {
      const original = await send(ava, { content: "the real words" })
      const id = randomUUID()
      const forged = await one<Msg>(
        ben,
        "insert into messages (id, channel_id, content, forwarded) values ($1, $2, '', $3) returning *",
        [id, general, { message_id: original.id, author_id: cy, content: "words Ava never said" }]
      )
      expect(forged.forwarded).toMatchObject({ author_id: ava, content: "the real words" })
    })

    it("refuses messages you can't see, and keeps snapshots unchanged on edit", async () => {
      const secret = await send(cy, { channel: elsewhere, content: "private" })
      expect(await as(db, ben, () => failure(db, "select * from send_message($1, $2, '', null, '[]', true, $3)", [randomUUID(), general, secret.id]))).toMatch(
        "can't be forwarded"
      )
      const original = await send(ava, { content: "original" })
      const forward = await send(ben, { forward: original.id })
      const edited = await one<Msg>(ben, "update messages set forwarded = '{\"content\":\"changed\"}' where id = $1 returning *", [forward.id])
      expect(edited.forwarded).toMatchObject({ content: "original" })
    })
  })

  describe("polls", () => {
    const poll = { question: "  Lunch?  ", answers: [{ text: "Pizza", emoji: "🍕" }, { text: "Sushi" }], duration_hours: 24 }

    it("normalizes the poll and sets when it ends", async () => {
      const msg = await send(ava, { poll })
      expect(msg.poll).toMatchObject({
        question: "Lunch?",
        multiselect: false,
        answers: [
          { id: 1, text: "Pizza", emoji: "🍕" },
          { id: 2, text: "Sushi", emoji: null },
        ],
      })
      const hours = (new Date(msg.poll!.expires_at).getTime() - Date.now()) / 3_600_000
      expect(hours).toBeGreaterThan(23.9)
      expect(hours).toBeLessThanOrEqual(24)
    })

    it("rejects bad polls", async () => {
      expect(await sendFails(ava, { ...poll, question: " " })).toMatch("1 to 300 characters")
      expect(await sendFails(ava, { ...poll, answers: [{ text: "Only one" }] })).toMatch("2 to 10 answers")
      expect(await sendFails(ava, { ...poll, answers: [{ text: "x".repeat(56) }, { text: "ok" }] })).toMatch("1 to 55 characters")
      expect(await sendFails(ava, { ...poll, duration_hours: 5 })).toMatch("how long")
      expect(await sendFails(ava, { ...poll, duration_hours: "1; drop table messages" })).toMatch("how long")
    })

    it("lets viewers vote, change their vote and see everyone's votes", async () => {
      const msg = await send(ava, { poll })
      await one(ben, "select vote_poll($1, $2::smallint[])", [msg.id, [1]])
      await one(ava, "select vote_poll($1, $2::smallint[])", [msg.id, [2]])
      await one(ben, "select vote_poll($1, $2::smallint[])", [msg.id, [2]])
      const votes = await as(db, ava, () =>
        rows<{ user_id: string; answer_id: number }>(db, "select user_id, answer_id from poll_votes where message_id = $1 order by user_id", [msg.id])
      )
      expect(votes).toHaveLength(2)
      expect(votes.every((v) => v.answer_id === 2)).toBe(true)
      expect(await as(db, cy, () => rows(db, "select * from poll_votes where message_id = $1", [msg.id]))).toEqual([])
      await one(ben, "select vote_poll($1, '{}'::smallint[])", [msg.id])
      expect(await as(db, ava, () => rows(db, "select * from poll_votes where message_id = $1 and user_id = $2", [msg.id, ben]))).toEqual([])
    })

    it("checks the answers, single choice and visibility", async () => {
      const msg = await send(ava, { poll })
      expect(await as(db, ben, () => failure(db, "select vote_poll($1, $2::smallint[])", [msg.id, [1, 2]]))).toMatch("only pick one")
      expect(await as(db, ben, () => failure(db, "select vote_poll($1, $2::smallint[])", [msg.id, [3]]))).toMatch("isn't in this poll")
      expect(await as(db, cy, () => failure(db, "select vote_poll($1, $2::smallint[])", [msg.id, [1]]))).toMatch("isn't available")
      const multi = await send(ava, { poll: { ...poll, multiselect: true } })
      await one(ben, "select vote_poll($1, $2::smallint[])", [multi.id, [1, 2]])
      expect(await as(db, ben, () => rows(db, "select * from poll_votes where message_id = $1", [multi.id]))).toHaveLength(2)
    })

    it("can be ended early by its author only, and then takes no votes", async () => {
      const msg = await send(ava, { poll })
      expect(await as(db, ben, () => failure(db, "select end_poll($1)", [msg.id]))).toMatch("Only the poll's author")
      // Authors can't rewrite a poll directly either.
      const tampered = await one<Msg>(ava, "update messages set poll = '{\"question\":\"x\"}' where id = $1 returning *", [msg.id])
      expect(tampered.poll?.question).toBe("Lunch?")
      await one(ava, "select end_poll($1)", [msg.id])
      expect(await as(db, ben, () => failure(db, "select vote_poll($1, $2::smallint[])", [msg.id, [1]]))).toMatch("has ended")
    })
  })

  describe("AutoMod", () => {
    it("checks forwarded text and poll text", async () => {
      const original = await send(ben, { content: "a forbidden word" })
      const serverId = (await rows<{ server_id: string }>(db, "select server_id from channels where id = $1", [general]))[0].server_id
      await one(ava, "insert into automod_rules (server_id, created_by, name, kind, keywords) values ($1, $2, 'Words', 'keyword', '{forbidden}') returning id", [
        serverId,
        ava,
      ])
      expect(await as(db, ben, () => failure(db, "select * from send_message($1, $2, '', null, '[]', true, $3)", [randomUUID(), general, original.id]))).toMatch(
        "blocked by AutoMod"
      )
      expect(await sendFails(ben, { ...poll(), question: "Is this forbidden?" })).toMatch("blocked by AutoMod")
    })

    function poll() {
      return { question: "q", answers: [{ text: "a" }, { text: "b" }], duration_hours: 1 }
    }
  })
})
