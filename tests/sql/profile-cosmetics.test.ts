import type { PGlite } from "@electric-sql/pglite"
import { beforeAll, describe, expect, it } from "vitest"

import { as, createDb, failure, rows, signUp } from "./harness"

/** Profile cosmetics: name styles, avatar decorations, profile effects and nameplates. */
describe("profile cosmetics (PGlite)", () => {
  let db: PGlite
  let ava: string
  let ben: string

  const save = (user: string, target: string, cosmetics: unknown) =>
    as(db, user, () =>
      rows(db, "update profiles set cosmetics = $1 where id = $2 returning id", [JSON.stringify(cosmetics), target])
    )
  const reject = (cosmetics: unknown) =>
    as(db, ava, () => failure(db, "update profiles set cosmetics = $1 where id = $2", [JSON.stringify(cosmetics), ava]))

  beforeAll(async () => {
    db = await createDb()
    ;[ava, ben] = await Promise.all(["ava", "ben"].map((u) => signUp(db, u)))
  }, 60_000)

  it("starts empty and saves a full set of cosmetics", async () => {
    const [row] = await rows<{ cosmetics: unknown }>(db, "select cosmetics from profiles where id = $1", [ava])
    expect(row.cosmetics).toEqual({})
    const saved = await save(ava, ava, {
      name_font: "retro",
      name_effect: "gradient",
      name_colors: ["#00c8ff", "#EB459E"],
      decoration: "neon",
      effect: "sakura",
      nameplate: "galaxy",
    })
    expect(saved).toHaveLength(1)
  })

  it("rejects unknown values, bad colors and non-objects", async () => {
    expect(await reject({ decoration: "lasers" })).toMatch(/profiles_cosmetics_valid/)
    expect(await reject({ name_font: "comic-sans" })).toMatch(/profiles_cosmetics_valid/)
    expect(await reject({ name_colors: ["red"] })).toMatch(/profiles_cosmetics_valid/)
    expect(await reject({ name_colors: ["#000000", "#111111", "#222222"] })).toMatch(/profiles_cosmetics_valid/)
    expect(await reject(["neon"])).toMatch(/profiles_cosmetics_valid/)
    expect(await reject({ effect: "x".repeat(2000) })).toMatch(/profiles_cosmetics_valid/)
  })

  it("only lets you change your own", async () => {
    expect(await save(ben, ava, { decoration: "halo" })).toHaveLength(0)
  })
})
