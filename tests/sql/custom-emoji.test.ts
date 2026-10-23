import type { PGlite } from "@electric-sql/pglite"
import { beforeAll, describe, expect, it } from "vitest"

import { as, createDb, failure, rows, signUp } from "./harness"

const MANAGE_EXPRESSIONS = 65536

/** Milestone 11: custom server emoji and their images. */
describe("custom emoji (PGlite)", () => {
  let db: PGlite
  let owner: string
  let member: string
  let outsider: string
  let serverId: string
  let everyoneRole: string
  let emojiId: string

  const one = async <T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) =>
    as(db, user, async () => (await rows<T>(db, sql, params))[0])
  const upload = (user: string, name: string) =>
    as(db, user, () => rows(db, "insert into storage.objects (bucket_id, name) values ('emojis', $1) returning name", [name]))

  beforeAll(async () => {
    db = await createDb()
    ;[owner, member, outsider] = await Promise.all(["owner", "member", "outsider"].map((u) => signUp(db, u)))
    ;({ id: serverId } = await one<{ id: string }>(owner, "select create_server('Emoji') as id"))
    const { code } = await one<{ code: string }>(owner, "select code from create_invite($1)", [serverId])
    await one(member, "select join_server_by_invite($1)", [code])
    everyoneRole = (await rows<{ id: string }>(db, "select id from roles where server_id = $1 and is_default", [serverId]))[0].id
  }, 60_000)

  it("lets the owner add an emoji and upload its image", async () => {
    ;({ id: emojiId } = await one<{ id: string }>(owner, "select create_server_emoji($1, 'party_blob') as id", [serverId]))
    expect(await upload(owner, emojiId)).toHaveLength(1)
  })

  it("shows emoji to members only", async () => {
    expect(await as(db, member, () => rows(db, "select name from server_emojis where server_id = $1", [serverId]))).toEqual([
      { name: "party_blob" },
    ])
    expect(await as(db, outsider, () => rows(db, "select name from server_emojis where server_id = $1", [serverId]))).toEqual([])
  })

  it("needs Manage Expressions to add, rename or remove", async () => {
    expect(await as(db, member, () => failure(db, "select create_server_emoji($1, 'nope')", [serverId]))).toMatch(
      /Manage Expressions/
    )
    expect(await as(db, member, () => failure(db, "select rename_server_emoji($1, 'mine')", [emojiId]))).toMatch(
      /Manage Expressions/
    )
    expect(await as(db, member, () => rows(db, "delete from server_emojis where id = $1 returning id", [emojiId]))).toEqual([])

    await one(owner, "select update_role($1, p_permissions => $2)", [everyoneRole, 62467 | MANAGE_EXPRESSIONS])
    const { id } = await one<{ id: string }>(member, "select create_server_emoji($1, 'member_made') as id", [serverId])
    expect(id).toBeTruthy()
    await one(owner, "select update_role($1, p_permissions => $2)", [everyoneRole, 62467])
  })

  it("only lets the creator upload an image, once, for a real emoji", async () => {
    const { id } = await one<{ id: string }>(owner, "select create_server_emoji($1, 'owner_second') as id", [serverId])
    expect(await as(db, member, () => failure(db, "insert into storage.objects (bucket_id, name) values ('emojis', $1)", [id]))).toMatch(
      /row-level security/
    )
    expect(
      await as(db, owner, () => failure(db, "insert into storage.objects (bucket_id, name) values ('emojis', 'not-an-emoji')"))
    ).toMatch(/row-level security/)
  })

  it("rejects bad names and duplicates", async () => {
    expect(await as(db, owner, () => failure(db, "select create_server_emoji($1, 'has space')", [serverId]))).toMatch(
      /name_format/
    )
    expect(await as(db, owner, () => failure(db, "select create_server_emoji($1, 'PARTY_BLOB')", [serverId]))).toMatch(
      /already has an emoji/
    )
  })

  it("renames and stops at 50 per server", async () => {
    await one(owner, "select rename_server_emoji($1, 'party_parrot')", [emojiId])
    expect((await rows<{ name: string }>(db, "select name from server_emojis where id = $1", [emojiId]))[0].name).toBe("party_parrot")

    const { count } = (await rows<{ count: number }>(db, "select count(*)::int as count from server_emojis where server_id = $1", [serverId]))[0]
    for (let i = count; i < 50; i++) await one(owner, "select create_server_emoji($1, $2)", [serverId, `filler_${i}`])
    expect(await as(db, owner, () => failure(db, "select create_server_emoji($1, 'one_too_many')", [serverId]))).toMatch(
      /50 emoji/
    )
  })

  it("accepts custom emoji tokens as reactions", async () => {
    const [{ id: general }] = await rows<{ id: string }>(db, "select id from channels where server_id = $1 and name = 'general'", [serverId])
    const { id: message } = await one<{ id: string }>(owner, "select * from send_message(gen_random_uuid(), $1, 'react to me')", [general])
    const token = `<a:${"x".repeat(32)}:${emojiId}>`
    const added = await as(db, member, () =>
      rows(db, "insert into reactions (message_id, channel_id, emoji) values ($1, $2, $3) returning emoji", [message, general, token])
    )
    expect(added).toHaveLength(1)
  })
})
