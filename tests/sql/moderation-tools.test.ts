import { randomUUID } from "node:crypto"

import type { PGlite } from "@electric-sql/pglite"
import { beforeAll, describe, expect, it } from "vitest"

import { as, createDb, failure, rows, signUp } from "./harness"

const VIEW_AUDIT_LOG = 131072

/** Milestone 13: audit log, AutoMod and voice moderation. */
describe("moderation tools (PGlite)", () => {
  let db: PGlite
  let owner: string
  let mod: string
  let member: string
  let other: string
  let serverId: string
  let general: string
  let modRole: string

  const one = async <T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) =>
    as(db, user, async () => (await rows<T>(db, sql, params))[0])
  const send = (user: string, content: string) =>
    as(db, user, () => rows<{ id: string }>(db, "select * from send_message($1, $2, $3)", [randomUUID(), general, content]))
  const log = () =>
    rows<{ action: string; actor_id: string; target_name: string | null; details: Record<string, unknown>; reason: string | null }>(
      db,
      "select action, actor_id, target_name, details, reason from audit_log where server_id = $1 order by created_at, id",
      [serverId]
    )
  const actions = async () => (await log()).map((e) => e.action)

  beforeAll(async () => {
    db = await createDb()
    ;[owner, mod, member, other] = await Promise.all(["owner", "mod", "member", "other"].map((u) => signUp(db, u)))
    ;({ id: serverId } = await one<{ id: string }>(owner, "select create_server('Mod tools') as id"))
    const { code } = await one<{ code: string }>(owner, "select code from create_invite($1)", [serverId])
    for (const u of [mod, member, other]) await one(u, "select join_server_by_invite($1)", [code])
    general = (await rows<{ id: string }>(db, "select id from channels where server_id = $1 and name = 'general'", [serverId]))[0].id
    ;({ id: modRole } = await one<{ id: string }>(owner, "select id from create_role($1, 'Moderator', null, $2)", [
      serverId,
      2 | 4 | 128 | 256 | 2048,
    ]))
    await one(owner, "select set_member_roles($1, $2, $3)", [serverId, mod, [modRole]])
  }, 60_000)

  describe("audit log", () => {
    it("records role, channel and invite changes with who did them", async () => {
      const entries = await log()
      expect(entries.map((e) => e.action)).toEqual(
        expect.arrayContaining(["invite_create", "role_create", "member_role_update"])
      )
      expect(entries.find((e) => e.action === "member_role_update")).toMatchObject({
        actor_id: owner,
        target_name: "mod",
        details: { added: "Moderator" },
      })
      await one(owner, "update channels set topic = 'Say hi', slowmode_seconds = 10 where id = $1 returning id", [general])
      const update = (await log()).find((e) => e.action === "channel_update")
      expect(update?.details).toEqual({ topic: [null, "Say hi"], slowmode: [0, 10] })
      await one(owner, "update channels set slowmode_seconds = 0 where id = $1 returning id", [general])
    })

    it("tells kicks apart from leaving, and bans from kicks", async () => {
      await one(mod, "select kick_member($1, $2)", [serverId, other])
      const { code } = await one<{ code: string }>(owner, "select code from create_invite($1)", [serverId])
      await one(other, "select join_server_by_invite($1)", [code])
      await one(other, "select leave_server($1)", [serverId])
      await one(other, "select join_server_by_invite($1)", [code])
      await send(other, "about to be banned")
      await one(mod, "select ban_member($1, $2, 'spam', 3600)", [serverId, other])
      const recent = (await log()).filter((e) => ["member_kick", "member_ban", "message_delete"].includes(e.action))
      expect(recent.map((e) => e.action)).toEqual(["member_kick", "member_ban"])
      expect(recent[1]).toMatchObject({ actor_id: mod, target_name: "other", reason: "spam" })
    })

    it("records moderators deleting other people's messages, not their own", async () => {
      const [{ id: mine }] = await send(mod, "my own")
      const [{ id: theirs }] = await send(member, "delete me")
      await as(db, mod, () => rows(db, "delete from messages where id = any($1) returning id", [[mine, theirs]]))
      const deletes = (await log()).filter((e) => e.action === "message_delete")
      expect(deletes).toHaveLength(1)
      expect(deletes[0]).toMatchObject({ target_name: "member", details: { channel: "general" } })
    })

    it("is only readable with View Audit Log", async () => {
      expect(await as(db, member, () => rows(db, "select 1 from audit_log where server_id = $1", [serverId]))).toEqual([])
      expect((await as(db, owner, () => rows(db, "select 1 from audit_log where server_id = $1", [serverId]))).length).toBeGreaterThan(0)
      await one(owner, "select update_role($1, p_permissions => $2)", [modRole, 2 | 4 | 128 | 256 | 2048 | VIEW_AUDIT_LOG])
      expect((await as(db, mod, () => rows(db, "select 1 from audit_log where server_id = $1", [serverId]))).length).toBeGreaterThan(0)
      expect(await as(db, member, () => failure(db, "insert into audit_log (server_id, action) values ($1, 'fake')", [serverId]))).toMatch(
        /row-level security/
      )
    })

    it("doesn't break deleting a whole server", async () => {
      const { id } = await one<{ id: string }>(owner, "select create_server('Temp') as id")
      await as(db, owner, () => rows(db, "delete from servers where id = $1 returning id", [id]))
      expect(await rows(db, "select 1 from audit_log where server_id = $1", [id])).toEqual([])
    })
  })

  describe("automod", () => {
    it("matches keywords the way Discord does", async () => {
      const match = async (content: string, keywords: string[], allow: string[] = []) =>
        (await one<{ hit: string | null }>(owner, "select automod_keyword_match($1, $2, $3) as hit", [content, keywords, allow])).hit
      expect(await match("that cat is cute", ["cat"])).toBe("cat")
      expect(await match("concatenate", ["cat"])).toBeNull()
      expect(await match("catapult", ["cat*"])).toBe("cat")
      expect(await match("bobcat", ["*cat"])).toBe("cat")
      expect(await match("concatenate", ["*cat*"])).toBe("cat")
      expect(await match("CAT!", ["cat"])).toBe("cat")
      expect(await match("scunthorpe is a town", ["*cunt*"], ["scunthorpe"])).toBeNull()
      expect(await match("a+b (test)", ["a+b"])).toBe("a+b")
    })

    it("blocks members' messages and edits, but not managers'", async () => {
      await as(db, owner, () =>
        rows(db, "insert into automod_rules (server_id, name, kind, keywords, created_by) values ($1, 'No swearing', 'keyword', $2, $3) returning id", [
          serverId,
          ["darn", "heck*"],
          owner,
        ])
      )
      expect(await as(db, member, () => failure(db, "select * from send_message($1, $2, 'oh darn it')", [randomUUID(), general]))).toMatch(
        /blocked by AutoMod \(No swearing\)/
      )
      const [{ id }] = await send(member, "this is fine")
      expect(await as(db, member, () => failure(db, "update messages set content = 'what the heckin' where id = $1", [id]))).toMatch(
        /blocked by AutoMod/
      )
      expect(await send(owner, "darn, I'm the owner")).toHaveLength(1)
    })

    it("lets exempt roles through", async () => {
      await one(owner, "update automod_rules set exempt_role_ids = $1 where server_id = $2 returning id", [[modRole], serverId])
      expect(await send(mod, "darn")).toHaveLength(1)
    })

    it("limits mention spam", async () => {
      await as(db, owner, () =>
        rows(db, "insert into automod_rules (server_id, name, kind, mention_limit, created_by) values ($1, 'Mentions', 'mention_spam', 2, $2) returning id", [
          serverId,
          owner,
        ])
      )
      const ids = [owner, mod, member].map((u) => `<@${u}>`).join(" ")
      expect(await as(db, member, () => failure(db, "select * from send_message($1, $2, $3)", [randomUUID(), general, ids]))).toMatch(
        /too many mentions/
      )
      expect(await send(member, `<@${owner}> <@${owner}> <@${mod}>`)).toHaveLength(1)
    })

    it("keeps rules private to server managers", async () => {
      expect(await as(db, member, () => rows(db, "select 1 from automod_rules where server_id = $1", [serverId]))).toEqual([])
      expect(await as(db, member, () => failure(db, "insert into automod_rules (server_id, name, kind, keywords, created_by) values ($1, 'x', 'keyword', '{a}', $2)", [serverId, member]))).toMatch(
        /row-level security/
      )
    })
  })

  describe("voice moderation", () => {
    it("lets moderators server mute and deafen members below them, and logs it", async () => {
      await one(mod, "select set_voice_moderation($1, $2, true, false)", [serverId, member])
      const [state] = await as(db, member, () =>
        rows<{ server_mute: boolean; server_deaf: boolean }>(db, "select server_mute, server_deaf from voice_moderation where server_id = $1 and user_id = $2", [serverId, member])
      )
      expect(state).toEqual({ server_mute: true, server_deaf: false })
      expect((await log()).find((e) => e.action === "member_voice_update")?.details).toEqual({ mute: [false, true], deaf: [false, false] })
    })

    it("respects the role hierarchy", async () => {
      expect(await as(db, member, () => failure(db, "select set_voice_moderation($1, $2, true, true)", [serverId, mod]))).toMatch(/moderate voice/)
      expect(await as(db, mod, () => failure(db, "select set_voice_moderation($1, $2, true, true)", [serverId, owner]))).toMatch(/owner/)
    })

    it("only allows pulling someone out of voice after they lost access", async () => {
      expect((await one<{ ok: boolean }>(mod, "select voice_removal_allowed($1, $2) as ok", [serverId, member])).ok).toBe(false)
      expect((await one<{ ok: boolean }>(mod, "select voice_removal_allowed($1, $2) as ok", [serverId, other])).ok).toBe(true)
      expect((await one<{ ok: boolean }>(member, "select voice_removal_allowed($1, $2) as ok", [serverId, other])).ok).toBe(false)
      await one(mod, "select timeout_member($1, $2, now() + interval '1 hour')", [serverId, member])
      expect((await one<{ ok: boolean }>(mod, "select voice_removal_allowed($1, $2) as ok", [serverId, member])).ok).toBe(true)
    })

    it("records disconnects", async () => {
      await one(mod, "select voice_disconnect_member($1, $2)", [serverId, member])
      expect(await actions()).toContain("member_disconnect")
    })
  })
})
