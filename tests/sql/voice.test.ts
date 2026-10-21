import type { PGlite } from "@electric-sql/pglite"
import { beforeAll, describe, expect, it } from "vitest"

import { as, createDb, failure, rows, signUp } from "./harness"

/** Milestone 9: who may watch and join voice channels (Realtime Presence topics). */
describe("voice channels (PGlite)", () => {
  let db: PGlite
  let owner: string
  let member: string
  let outsider: string
  let serverId: string
  let voice: string
  let general: string
  let everyoneRole: string

  const one = async <T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) =>
    as(db, user, async () => (await rows<T>(db, sql, params))[0])
  const canJoin = async (user: string, channel: string) =>
    (await one<{ ok: boolean }>(user, "select can_join_voice($1) as ok", [channel])).ok

  /** Whether `user` may receive messages on a topic (subscribe / watch presence). */
  const canWatch = (user: string, topic: string) =>
    as(db, user, async () => {
      await db.query("select set_config('realtime.topic', $1, false)", [topic])
      return (await rows(db, "select 1 from realtime.messages where topic = $1", [topic])).length > 0
    })

  /** Whether `user` may publish on a topic with the given extension (presence track / broadcast). */
  const canAnnounce = (user: string, topic: string, extension = "presence") =>
    as(db, user, async () => {
      await db.query("select set_config('realtime.topic', $1, false)", [topic])
      try {
        await db.query("insert into realtime.messages (topic, extension) values ($1, $2)", [topic, extension])
        return true
      } catch {
        return false
      }
    })

  beforeAll(async () => {
    db = await createDb()
    ;[owner, member, outsider] = await Promise.all(["owner", "member", "outsider"].map((u) => signUp(db, u)))
    ;({ id: serverId } = await one<{ id: string }>(owner, "select create_server('Voice') as id"))
    const { code } = await one<{ code: string }>(owner, "select code from create_invite($1)", [serverId])
    await one(member, "select join_server_by_invite($1)", [code])
    const channel = (type: string) =>
      rows<{ id: string }>(db, "select id from channels where server_id = $1 and type = $2", [serverId, type])
    voice = (await channel("voice"))[0].id
    general = (await rows<{ id: string }>(db, "select id from channels where server_id = $1 and name = 'general'", [serverId]))[0].id
    everyoneRole = (await rows<{ id: string }>(db, "select id from roles where server_id = $1 and is_default", [serverId]))[0].id
    // A row on each topic so the select policies have something to show.
    await db.query("insert into realtime.messages (topic, extension) values ($1, 'presence')", [`voice:${voice}`])
  }, 60_000)

  it("lets members join the default voice channel and keeps outsiders out", async () => {
    expect(await canJoin(member, voice)).toBe(true)
    expect(await canJoin(outsider, voice)).toBe(false)
    expect(await canWatch(member, `voice:${voice}`)).toBe(true)
    expect(await canWatch(outsider, `voice:${voice}`)).toBe(false)
    expect(await canAnnounce(member, `voice:${voice}`)).toBe(true)
    expect(await canAnnounce(outsider, `voice:${voice}`)).toBe(false)
  })

  it("lets connected members send speaking events, and nobody else", async () => {
    expect(await canAnnounce(member, `voice:${voice}`, "broadcast")).toBe(true)
    expect(await canAnnounce(outsider, `voice:${voice}`, "broadcast")).toBe(false)
    expect(await canAnnounce(member, `voice:${voice}`, "postgres_changes")).toBe(false)
  })

  it("rejects text channels and junk topics", async () => {
    expect(await canJoin(member, general)).toBe(false)
    expect(await canAnnounce(member, `voice:${general}`)).toBe(false)
    expect(await canAnnounce(member, "voice:not-a-uuid")).toBe(false)
  })

  it("needs CONNECT", async () => {
    await one(owner, "select update_role($1, p_permissions => $2)", [everyoneRole, 1 | 2])
    expect(await canJoin(member, voice)).toBe(false)
    expect(await canAnnounce(member, `voice:${voice}`)).toBe(false)
    // Without CONNECT you can still see who's there.
    expect(await canWatch(member, `voice:${voice}`)).toBe(true)
    expect(await canJoin(owner, voice)).toBe(true)
    await one(owner, "select update_role($1, p_permissions => $2)", [everyoneRole, 1 | 2 | 16384 | 32768])
    expect(await canJoin(member, voice)).toBe(true)
  })

  it("keeps timed-out members out until the timeout ends", async () => {
    await one(owner, "select timeout_member($1, $2, now() + interval '1 hour')", [serverId, member])
    expect(await canJoin(member, voice)).toBe(false)
    await one(owner, "select timeout_member($1, $2, now() - interval '1 second')", [serverId, member])
    expect(await canJoin(member, voice)).toBe(true)
  })

  it("follows private channel access", async () => {
    const [{ id: secret }] = await as(db, owner, () =>
      rows<{ id: string }>(db, "insert into channels (server_id, type, name) values ($1, 'voice', 'Staff') returning id", [serverId])
    )
    await db.query("insert into realtime.messages (topic, extension) values ($1, 'presence')", [`voice:${secret}`])
    await one(owner, "select set_channel_access($1, true, '{}')", [secret])
    expect(await canWatch(member, `voice:${secret}`)).toBe(false)
    expect(await canAnnounce(member, `voice:${secret}`)).toBe(false)
    expect(await canWatch(owner, `voice:${secret}`)).toBe(true)
  })

  it("isn't callable anonymously", async () => {
    expect(await as(db, null, () => failure(db, "select can_join_voice($1)", [voice]))).toMatch(/permission denied/)
  })
})
