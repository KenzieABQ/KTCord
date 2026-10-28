import { randomUUID } from "node:crypto"

import type { PGlite } from "@electric-sql/pglite"
import { beforeAll, describe, expect, it } from "vitest"

import { as, createDb, failure, rows, signUp } from "./harness"

const VIDEO = 262144

/** Milestone 15: the Video permission and text chat in voice channels. */
describe("video and text in voice (PGlite)", () => {
  let db: PGlite
  let owner: string
  let member: string
  let serverId: string
  let voice: string

  const one = async <T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) =>
    as(db, user, async () => (await rows<T>(db, sql, params))[0])

  beforeAll(async () => {
    db = await createDb()
    ;[owner, member] = await Promise.all(["owner", "member"].map((u) => signUp(db, u)))
    ;({ id: serverId } = await one<{ id: string }>(owner, "select create_server('Video') as id"))
    const { code } = await one<{ code: string }>(owner, "select code from create_invite($1)", [serverId])
    await one(member, "select join_server_by_invite($1)", [code])
    voice = (await rows<{ id: string }>(db, "select id from channels where server_id = $1 and type = 'voice'", [serverId]))[0].id
  }, 60_000)

  it("gives @everyone Video in new servers", async () => {
    const perms = await one<{ p: number }>(member, "select channel_permissions($1)::int as p", [voice])
    expect(perms.p & VIDEO).toBe(VIDEO)
  })

  it("lets channel overrides deny Video", async () => {
    const everyone = (await rows<{ id: string }>(db, "select id from roles where server_id = $1 and is_default", [serverId]))[0].id
    await one(owner, "select set_channel_overwrite($1, $2, null, 0, $3)", [voice, everyone, VIDEO])
    const perms = await one<{ p: number }>(member, "select channel_permissions($1)::int as p", [voice])
    expect(perms.p & VIDEO).toBe(0)
    await one(owner, "select set_channel_overwrite($1, $2, null, 0, 0)", [voice, everyone])
  })

  it("allows messages in voice channels for people who can send", async () => {
    const sent = await one<{ content: string }>(member, "select * from send_message($1, $2, 'hi from voice')", [randomUUID(), voice])
    expect(sent.content).toBe("hi from voice")
    const category = (await rows<{ id: string }>(db, "select id from channels where server_id = $1 and type = 'category'", [serverId]))[0].id
    expect(await as(db, member, () => failure(db, "select * from send_message($1, $2, 'nope')", [randomUUID(), category]))).toMatch(
      "permission"
    )
  })

  it("lets the people in a DM join its call, and nobody else", async () => {
    const outsider = await signUp(db, "outsider")
    const { id: dm } = await one<{ id: string }>(owner, "select open_dm($1) as id", [member])
    expect((await one<{ ok: boolean }>(member, "select can_join_voice($1) as ok", [dm])).ok).toBe(true)
    expect((await one<{ ok: boolean }>(owner, "select can_join_voice($1) as ok", [dm])).ok).toBe(true)
    expect((await one<{ ok: boolean }>(outsider, "select can_join_voice($1) as ok", [dm])).ok).toBe(false)
  })
})
