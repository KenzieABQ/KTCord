import { randomUUID } from "node:crypto"

import type { PGlite } from "@electric-sql/pglite"
import { beforeAll, describe, expect, it } from "vitest"

import { as, createDb, failure, rows, signUp } from "./harness"

/** Milestone 12: per-channel permission overrides and slow mode. */
describe("channel settings (PGlite)", () => {
  let db: PGlite
  let owner: string
  let member: string
  let mod: string
  let serverId: string
  let general: string
  let everyoneRole: string
  let modRole: string

  const one = async <T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) =>
    as(db, user, async () => (await rows<T>(db, sql, params))[0])
  const perms = async (user: string, channel: string) =>
    Number((await one<{ p: string }>(user, "select channel_permissions($1) as p", [channel])).p)
  const send = (user: string, channel: string, content: string) =>
    as(db, user, () => rows(db, "select * from send_message($1, $2, $3)", [randomUUID(), channel, content]))
  const setOverwrite = (user: string, channel: string, role: string | null, target: string | null, allow: number, deny: number) =>
    one(user, "select set_channel_overwrite($1, $2, $3, $4, $5)", [channel, role, target, allow, deny])

  beforeAll(async () => {
    db = await createDb()
    ;[owner, member, mod] = await Promise.all(["owner", "member", "mod"].map((u) => signUp(db, u)))
    ;({ id: serverId } = await one<{ id: string }>(owner, "select create_server('Settings') as id"))
    const { code } = await one<{ code: string }>(owner, "select code from create_invite($1)", [serverId])
    await one(member, "select join_server_by_invite($1)", [code])
    await one(mod, "select join_server_by_invite($1)", [code])
    general = (await rows<{ id: string }>(db, "select id from channels where server_id = $1 and name = 'general'", [serverId]))[0].id
    everyoneRole = (await rows<{ id: string }>(db, "select id from roles where server_id = $1 and is_default", [serverId]))[0].id
    ;({ id: modRole } = await one<{ id: string }>(owner, "select id from create_role($1, 'Moderator', null, $2)", [serverId, 32 | 4]))
    await one(owner, "select set_member_roles($1, $2, $3)", [serverId, mod, [modRole]])
  }, 60_000)

  describe("overrides", () => {
    it("denies @everyone sending in a read-only channel, while a role override allows it", async () => {
      await setOverwrite(owner, general, everyoneRole, null, 0, 2)
      expect((await perms(member, general)) & 2).toBe(0)
      expect(await as(db, member, () => failure(db, "select * from send_message($1, $2, 'hi')", [randomUUID(), general]))).toMatch(
        /permission to send/
      )

      await setOverwrite(owner, general, modRole, null, 2, 0)
      expect((await perms(mod, general)) & 2).toBe(2)
      expect(await send(mod, general, "mods can still talk")).toHaveLength(1)
    })

    it("lets a member override beat role overrides", async () => {
      await setOverwrite(owner, general, null, member, 2, 0)
      expect((await perms(member, general)) & 2).toBe(2)
      await setOverwrite(owner, general, null, member, 0, 0)
      expect((await perms(member, general)) & 2).toBe(0)
      expect(await rows(db, "select 1 from channel_overwrites where user_id = $1", [member])).toHaveLength(0)
    })

    it("hides a channel when View Channel is denied", async () => {
      const [{ id: secret }] = await as(db, owner, () =>
        rows<{ id: string }>(db, "insert into channels (server_id, type, name) values ($1, 'text', 'hidden') returning id", [serverId])
      )
      await setOverwrite(owner, secret, everyoneRole, null, 0, 1)
      expect(await as(db, member, () => rows(db, "select id from channels where id = $1", [secret]))).toEqual([])
      expect(await perms(member, secret)).toBe(0)
      expect(await as(db, owner, () => rows(db, "select id from channels where id = $1", [secret]))).toHaveLength(1)
    })

    it("only allows channel permissions, and only people who manage roles", async () => {
      expect(await as(db, member, () => failure(db, "select set_channel_overwrite($1, $2, null, 2, 0)", [general, everyoneRole]))).toMatch(
        /manage roles/
      )
      expect(await as(db, owner, () => failure(db, "select set_channel_overwrite($1, $2, null, 512, 0)", [general, everyoneRole]))).toMatch(
        /can't be set per channel/
      )
      expect(await as(db, owner, () => failure(db, "select set_channel_overwrite($1, $2, null, 2, 2)", [general, everyoneRole]))).toMatch(
        /both allowed and denied/
      )
    })

    it("stops moderators from allowing what they don't have or touching higher roles", async () => {
      // Take SPEAK away from @everyone, so the moderator no longer has it to give.
      await one(owner, "select update_role($1, p_permissions => $2)", [everyoneRole, 62467 & ~32768])
      expect(await as(db, mod, () => failure(db, "select set_channel_overwrite($1, $2, null, 32768, 0)", [general, everyoneRole]))).toMatch(
        /don't have/
      )
      expect(await as(db, mod, () => failure(db, "select set_channel_overwrite($1, $2, null, 2, 0)", [general, modRole]))).toMatch(
        /below your highest role/
      )
      await one(owner, "select update_role($1, p_permissions => $2)", [everyoneRole, 62467])
    })

    it("applies to threads through their parent channel", async () => {
      const [{ id: starter }] = await send(mod, general, "thread starter") as { id: string }[]
      const { id: thread } = await one<{ id: string }>(owner, "select create_thread($1, 'plans') as id", [starter])
      expect((await perms(member, thread)) & 2).toBe(0)
      expect((await perms(mod, thread)) & 2).toBe(2)
    })
  })

  describe("slow mode", () => {
    let slow: string

    beforeAll(async () => {
      const [{ id }] = await as(db, owner, () =>
        rows<{ id: string }>(db, "insert into channels (server_id, type, name, slowmode_seconds) values ($1, 'text', 'slow', 30) returning id", [serverId])
      )
      slow = id
    })

    it("makes members wait between messages", async () => {
      expect(await send(member, slow, "first")).toHaveLength(1)
      expect(await as(db, member, () => failure(db, "select * from send_message($1, $2, 'second')", [randomUUID(), slow]))).toMatch(
        /Slow mode is on/
      )
    })

    it("still accepts a retry of the same message", async () => {
      const [{ id: quiet }] = await as(db, owner, () =>
        rows<{ id: string }>(db, "insert into channels (server_id, type, name) values ($1, 'text', 'retry') returning id", [serverId])
      )
      const id = randomUUID()
      expect(await as(db, member, () => rows(db, "select * from send_message($1, $2, 'once')", [id, quiet]))).toHaveLength(1)
      await one(owner, "update channels set slowmode_seconds = 60 where id = $1 returning id", [quiet])
      // The client retrying the same message id isn't a second message.
      expect(await as(db, member, () => rows(db, "select * from send_message($1, $2, 'once')", [id, quiet]))).toHaveLength(1)
    })

    it("doesn't slow down people who manage messages", async () => {
      expect(await send(mod, slow, "one")).toHaveLength(1)
      expect(await send(mod, slow, "two")).toHaveLength(1)
    })

    it("only allows 0 to 6 hours", async () => {
      expect(await as(db, owner, () => failure(db, "update channels set slowmode_seconds = 99999 where id = $1", [slow]))).toMatch(
        /slowmode_range/
      )
    })
  })
})
