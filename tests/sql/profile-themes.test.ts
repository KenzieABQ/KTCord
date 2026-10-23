import type { PGlite } from "@electric-sql/pglite"
import { beforeAll, describe, expect, it } from "vitest"

import { as, createDb, failure, rows, signUp } from "./harness"

/** Milestone 10: pronouns, banner images and profile theme colors. */
describe("profile themes (PGlite)", () => {
  let db: PGlite
  let ava: string
  let ben: string
  const base = "https://example.supabase.co/storage/v1/object/public/avatars"

  const update = (user: string, set: string, params: unknown[]) =>
    as(db, user, () => rows(db, `update profiles set ${set} where id = $${params.length + 1} returning id`, [...params, user]))

  beforeAll(async () => {
    db = await createDb()
    ;[ava, ben] = await Promise.all(["ava", "ben"].map((u) => signUp(db, u)))
  }, 60_000)

  it("saves pronouns, theme colors and a banner from your own folder", async () => {
    const saved = await update(ava, "pronouns = $1, theme_primary = $2, theme_accent = $3, banner_url = $4", [
      "she/her",
      "#1e1f22",
      "#5865f2",
      `${base}/${ava}/123.webp`,
    ])
    expect(saved).toHaveLength(1)
  })

  it("rejects malformed colors and over-long pronouns", async () => {
    expect(await as(db, ava, () => failure(db, "update profiles set theme_primary = 'red' where id = $1", [ava]))).toMatch(
      /theme_primary_format/
    )
    expect(
      await as(db, ava, () => failure(db, "update profiles set pronouns = $1 where id = $2", ["x".repeat(41), ava]))
    ).toMatch(/pronouns_length/)
  })

  it("only accepts banners stored in the user's own folder", async () => {
    expect(
      await as(db, ava, () =>
        failure(db, "update profiles set banner_url = $1 where id = $2", [`${base}/${ben}/1.webp`, ava])
      )
    ).toMatch(/banner_url_own_folder/)
    expect(
      await as(db, ava, () =>
        failure(db, "update profiles set banner_url = $1 where id = $2", ["https://tracker.example/pixel.gif", ava])
      )
    ).toMatch(/banner_url_own_folder/)
  })

  it("doesn't let anyone else change your theme", async () => {
    expect(await update(ben, "theme_primary = $1", ["#000000"]).then(() => "ok")).toBe("ok")
    const [ava2] = await rows<{ theme_primary: string }>(db, "select theme_primary from profiles where id = $1", [ava])
    expect(ava2.theme_primary).toBe("#1e1f22")
    const hijack = await as(db, ben, () =>
      rows(db, "update profiles set theme_primary = '#000000' where id = $1 returning id", [ava])
    )
    expect(hijack).toHaveLength(0)
  })
})
