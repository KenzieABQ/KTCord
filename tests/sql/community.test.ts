import { randomUUID } from "node:crypto"

import type { PGlite } from "@electric-sql/pglite"
import { beforeAll, describe, expect, it } from "vitest"

import { as, createDb, failure, rows, signUp } from "./harness"

const MANAGE_EVENTS = 524288

/** Milestone 16: announcement and forum channels, events, rules and vanity links. */
describe("community features (PGlite)", () => {
  let db: PGlite
  let owner: string
  let member: string
  let other: string
  let serverId: string
  let otherServer: string
  let code: string

  const one = async <T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) =>
    as(db, user, async () => (await rows<T>(db, sql, params))[0])
  const fails = (user: string, sql: string, params: unknown[] = []) => as(db, user, () => failure(db, sql, params))
  const createChannel = (user: string, server: string, type: string, name: string) =>
    one<{ id: string }>(user, "insert into channels (server_id, type, name) values ($1, $2, $3) returning id", [server, type, name])
  const send = (user: string, channel: string, content: string) =>
    one<{ id: string }>(user, "select * from send_message($1, $2, $3)", [randomUUID(), channel, content])

  beforeAll(async () => {
    db = await createDb()
    ;[owner, member, other] = await Promise.all(["owner", "member", "other"].map((u) => signUp(db, u)))
    ;({ id: serverId } = await one<{ id: string }>(owner, "select create_server('Community') as id"))
    ;({ code } = await one<{ code: string }>(owner, "select code from create_invite($1)", [serverId]))
    await one(member, "select join_server_by_invite($1)", [code])
    ;({ id: otherServer } = await one<{ id: string }>(other, "select create_server('Elsewhere') as id"))
  }, 60_000)

  describe("announcement channels", () => {
    it("only let members with an override (or managers) post", async () => {
      const { id: news } = await createChannel(owner, serverId, "announcement", "News Room")
      expect((await rows<{ name: string }>(db, "select name from channels where id = $1", [news]))[0].name).toBe("news-room")
      expect(await fails(member, "select * from send_message($1, $2, 'hi')", [randomUUID(), news])).toMatch("permission")
      expect((await send(owner, news, "Big news")).id).toBeTruthy()
    })

    it("publish posts to channels in other servers that follow them", async () => {
      const { id: news } = await createChannel(owner, serverId, "announcement", "updates")
      const target = (await rows<{ id: string }>(db, "select id from channels where server_id = $1 and type = 'text'", [otherServer]))[0].id
      // The other server's owner can see the source only as a member.
      expect(await fails(other, "select follow_channel($1, $2)", [news, target])).toMatch("isn't available")
      await one(other, "select join_server_by_invite($1)", [code])
      await one(other, "select follow_channel($1, $2)", [news, target])
      expect(await fails(member, "select follow_channel($1, $2)", [news, target])).toMatch("Manage Channels")

      const post = await send(owner, news, "Version 2 is out")
      expect(await fails(member, "select publish_message($1)", [post.id])).toMatch("can't publish")
      expect((await one<{ n: number }>(owner, "select publish_message($1) as n", [post.id])).n).toBe(1)
      expect(await fails(owner, "select publish_message($1)", [post.id])).toMatch("already published")
      const copy = await one<{ forwarded: Record<string, unknown> }>(
        other,
        "select forwarded from messages where channel_id = $1 order by created_at desc limit 1",
        [target]
      )
      expect(copy.forwarded).toMatchObject({ content: "Version 2 is out", published: true, channel_name: "updates", server_name: "Community" })
      await one(other, "select leave_server($1)", [serverId])
    })

    it("can't be marked published by hand", async () => {
      const { id: news } = await createChannel(owner, serverId, "announcement", "manual")
      const post = await send(owner, news, "draft")
      const updated = await one<{ published_at: string | null }>(owner, "update messages set published_at = now() where id = $1 returning published_at", [post.id])
      expect(updated.published_at).toBeNull()
    })
  })

  describe("forums", () => {
    it("take posts as titled threads with tags from the forum, not plain messages", async () => {
      const { id: forum } = await createChannel(owner, serverId, "forum", "Help")
      await one(owner, "update channels set available_tags = $2 where id = $1 returning id", [
        forum,
        JSON.stringify([{ id: "bug", name: "Bug", emoji: null }, { id: "idea", name: "Idea", emoji: "💡" }]),
      ])
      expect(await fails(member, "select * from send_message($1, $2, 'chat')", [randomUUID(), forum])).toMatch("permission")
      const { id: post } = await one<{ id: string }>(member, "select create_forum_post($1, 'App crashes', $2, 'Steps to reproduce…', $3) as id", [
        forum,
        randomUUID(),
        ["bug", "made-up"],
      ])
      const thread = (await rows<{ type: string; name: string; applied_tags: string[] }>(db, "select type, name, applied_tags from channels where id = $1", [post]))[0]
      expect(thread).toEqual({ type: "thread", name: "App crashes", applied_tags: ["bug"] })
      await send(owner, post, "Thanks, looking into it")
      const posts = await as(db, member, () => rows<{ name: string; message_count: number; first_message: string }>(db, "select * from forum_posts($1)", [forum]))
      expect(posts[0]).toMatchObject({ name: "App crashes", message_count: 2, first_message: "Steps to reproduce…" })
      expect(await fails(member, "select create_forum_post($1, ' ', $2, 'x')", [forum, randomUUID()])).toMatch("title")
    })
  })

  describe("events", () => {
    it("need Manage Events to create; members can mark interest", async () => {
      const voice = (await rows<{ id: string }>(db, "select id from channels where server_id = $1 and type = 'voice'", [serverId]))[0].id
      const starts = new Date(Date.now() + 86_400_000).toISOString()
      const insert = "insert into scheduled_events (server_id, channel_id, name, starts_at, created_by) values ($1, $2, 'Game night', $3, $4) returning id"
      expect(await fails(member, insert, [serverId, voice, starts, member])).toMatch("row-level security")
      const { id: event } = await one<{ id: string }>(owner, insert, [serverId, voice, starts, owner])
      await one(member, "insert into event_interests (event_id) values ($1) returning id", [event])
      expect(await as(db, other, () => rows(db, "select * from scheduled_events where id = $1", [event]))).toEqual([])
      const { n } = await one<{ n: number }>(owner, "select count(*)::int as n from event_interests where event_id = $1", [event])
      expect(n).toBe(1)
      const textChannel = (await rows<{ id: string }>(db, "select id from channels where server_id = $1 and type = 'text'", [serverId]))[0].id
      expect(await fails(owner, insert, [serverId, textChannel, starts, owner])).toMatch("voice channel")
      // A role with Manage Events can create them too.
      const { id: role } = await one<{ id: string }>(owner, "select id from create_role($1, 'Hosts', null, $2)", [serverId, 2 | MANAGE_EVENTS])
      await one(owner, "select set_member_roles($1, $2, $3)", [serverId, member, [role]])
      expect((await one<{ id: string }>(member, insert, [serverId, voice, starts, member])).id).toBeTruthy()
    })
  })

  describe("rules", () => {
    it("hold new members back until they accept, without affecting existing ones", async () => {
      await one(owner, "update servers set rules = '{Be kind,No spam}', rules_enabled = true where id = $1 returning id", [serverId])
      const general = (await rows<{ id: string }>(db, "select id from channels where server_id = $1 and name = 'general'", [serverId]))[0].id
      expect((await send(member, general, "still fine")).id).toBeTruthy()
      const newcomer = await signUp(db, "newcomer")
      await one(newcomer, "select join_server_by_invite($1)", [code])
      expect(await fails(newcomer, "select * from send_message($1, $2, 'hello')", [randomUUID(), general])).toMatch("permission")
      // They can't clear it themselves.
      await one(newcomer, "update server_members set pending = false where server_id = $1 and user_id = $2 returning user_id", [serverId, newcomer])
      expect(await fails(newcomer, "select * from send_message($1, $2, 'hello')", [randomUUID(), general])).toMatch("permission")
      await one(newcomer, "select accept_rules($1)", [serverId])
      expect((await send(newcomer, general, "hello")).id).toBeTruthy()
      await one(owner, "update servers set rules_enabled = false where id = $1 returning id", [serverId])
    })
  })

  describe("vanity links", () => {
    it("work like invites and are validated", async () => {
      await one(owner, "update servers set vanity_code = 'community' where id = $1 returning id", [serverId])
      const preview = await one<{ server_id: string; is_valid: boolean }>(other, "select * from get_invite('Community')")
      expect(preview).toMatchObject({ server_id: serverId, is_valid: true })
      expect((await one<{ id: string }>(other, "select join_server_by_invite('community') as id")).id).toBe(serverId)
      expect(await fails(owner, "update servers set vanity_code = 'No Spaces' where id = $1", [serverId])).toMatch("servers_community_shape")
      expect(await fails(other, "update servers set vanity_code = 'community' where id = $1 returning id", [otherServer])).toMatch("duplicate")
    })
  })
})
