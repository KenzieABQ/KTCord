import { describe, expect, it } from "vitest"

import { decodeMentions, encodeMentions, findTrigger, rankMatches, type MentionSources } from "./mentions"

const AVA = "11111111-1111-1111-1111-111111111111"
const BEN = "22222222-2222-2222-2222-222222222222"
const MODS = "33333333-3333-3333-3333-333333333333"
const GEN = "44444444-4444-4444-4444-444444444444"

const sources: MentionSources = {
  users: [
    { id: AVA, username: "ava", name: "Ava" },
    { id: BEN, username: "ben.dev", name: "Ben" },
  ],
  roles: [{ id: MODS, name: "Mod Squad" }],
  channels: [{ id: GEN, name: "general" }],
}

describe("encodeMentions", () => {
  it("turns readable mentions into tokens", () => {
    expect(encodeMentions("hi @ava and @Mod Squad, see #general.", sources)).toBe(
      `hi <@${AVA}> and <@&${MODS}>, see <#${GEN}>.`
    )
  })

  it("keeps trailing periods out of usernames that contain periods", () => {
    expect(encodeMentions("thanks @ben.dev.", sources)).toBe(`thanks <@${BEN}>.`)
  })

  it("leaves unknown names, emails and code alone", () => {
    expect(encodeMentions("@nobody me@ava.com `@ava` #nope", sources)).toBe("@nobody me@ava.com `@ava` #nope")
    expect(encodeMentions("```\n@ava\n```", sources)).toBe("```\n@ava\n```")
  })

  it("doesn't touch @everyone", () => {
    expect(encodeMentions("@everyone hi", sources)).toBe("@everyone hi")
  })
})

describe("decodeMentions", () => {
  it("round-trips for editing", () => {
    const text = "hi @ava and @Mod Squad in #general"
    expect(decodeMentions(encodeMentions(text, sources), sources)).toBe(text)
  })
})

describe("findTrigger", () => {
  it("finds @ and # being typed", () => {
    expect(findTrigger("hello @av", 9)).toEqual({ kind: "@", query: "av", start: 6 })
    expect(findTrigger("#", 1)).toEqual({ kind: "#", query: "", start: 0 })
    expect(findTrigger("email me@x", 10)).toBeNull()
    expect(findTrigger("done @ava ", 10)).toBeNull()
  })
})

describe("rankMatches", () => {
  it("puts prefix matches before substring matches", () => {
    const items = ["xavier", "ava", "dave"]
    expect(rankMatches(items, "av", (s) => [s])).toEqual(["ava", "xavier", "dave"])
  })
})

describe("findTrigger (emoji)", () => {
  it("starts suggesting after a colon and two characters", () => {
    expect(findTrigger("so funny :jo", 12)).toEqual({ kind: ":", query: "jo", start: 9 })
    expect(findTrigger(":j", 2)).toBeNull()
    expect(findTrigger("at 10:30", 8)).toBeNull()
  })
})
