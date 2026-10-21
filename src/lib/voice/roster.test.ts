import { describe, expect, it } from "vitest"

import { isSpeakingEvent, rosterFromPresence, sameRoster, type VoicePresenceMeta } from "./roster"

const meta = (user: string, joined: string, extra: Partial<VoicePresenceMeta> = {}): VoicePresenceMeta => ({
  user_id: user,
  self_mute: false,
  self_deaf: false,
  joined_at: joined,
  ...extra,
})

describe("rosterFromPresence", () => {
  it("lists people in join order", () => {
    const roster = rosterFromPresence({
      b: [meta("b", "2026-10-21T10:00:02Z")],
      a: [meta("a", "2026-10-21T10:00:01Z", { self_mute: true })],
    })
    expect(roster.map((m) => m.userId)).toEqual(["a", "b"])
    expect(roster[0].selfMute).toBe(true)
  })

  it("shows someone in two tabs once, using their latest connection", () => {
    const roster = rosterFromPresence({
      a: [meta("a", "2026-10-21T10:00:01Z", { self_deaf: true }), meta("a", "2026-10-21T10:05:00Z")],
    })
    expect(roster).toHaveLength(1)
    expect(roster[0]).toMatchObject({ selfDeaf: false, joinedAt: "2026-10-21T10:05:00Z" })
  })

  it("marks who is speaking, but never someone muted", () => {
    const state = { a: [meta("a", "1")], b: [meta("b", "2", { self_mute: true })] }
    const roster = rosterFromPresence(state, { a: true, b: true })
    expect(roster.map((m) => m.speaking)).toEqual([true, false])
  })

  it("ignores malformed metas", () => {
    expect(rosterFromPresence({ a: [{} as VoicePresenceMeta] })).toEqual([])
  })
})

describe("sameRoster", () => {
  it("compares the visible fields", () => {
    const a = rosterFromPresence({ a: [meta("a", "1")] })
    expect(sameRoster(a, rosterFromPresence({ a: [meta("a", "1")] }))).toBe(true)
    expect(sameRoster(a, rosterFromPresence({ a: [meta("a", "1")] }, { a: true }))).toBe(false)
    expect(sameRoster(undefined, a)).toBe(false)
  })
})

describe("isSpeakingEvent", () => {
  it("accepts well-formed events only", () => {
    expect(isSpeakingEvent({ user_id: "a", speaking: true })).toBe(true)
    expect(isSpeakingEvent({ user_id: "a", speaking: "yes" })).toBe(false)
    expect(isSpeakingEvent(null)).toBe(false)
  })
})
