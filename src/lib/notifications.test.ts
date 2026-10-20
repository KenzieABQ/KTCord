import { describe, expect, it } from "vitest"

import type { NotificationSetting } from "@/lib/api/settings"

import { effectiveLevel, indexPrefs, isMutedSetting, shouldNotify } from "./notifications"

const row = (partial: Partial<NotificationSetting>): NotificationSetting => ({
  id: crypto.randomUUID(),
  user_id: "me",
  server_id: null,
  channel_id: null,
  level: null,
  muted_until: null,
  ...partial,
})

const now = new Date("2026-10-20T12:00:00Z")

describe("notification preferences", () => {
  it("resolves channel, then server, then the default level", () => {
    const prefs = indexPrefs([
      row({ server_id: "s", level: "all" }),
      row({ channel_id: "quiet", level: "nothing" }),
    ])
    expect(effectiveLevel(prefs, "s", "general")).toBe("all")
    expect(effectiveLevel(prefs, "s", "quiet")).toBe("nothing")
    expect(effectiveLevel(prefs, "other", "x")).toBe("mentions")
  })

  it("understands timed and indefinite mutes", () => {
    expect(isMutedSetting(row({ muted_until: "infinity" }), now)).toBe(true)
    expect(isMutedSetting(row({ muted_until: "2026-10-20T13:00:00Z" }), now)).toBe(true)
    expect(isMutedSetting(row({ muted_until: "2026-10-20T11:00:00Z" }), now)).toBe(false)
  })

  it("decides when to notify", () => {
    const prefs = indexPrefs([row({ server_id: "muted", muted_until: "infinity" })])
    const base = { prefs, channelId: "c", isDm: false, dnd: false, now }
    expect(shouldNotify({ ...base, serverId: "s", mentionsMe: true })).toBe(true)
    expect(shouldNotify({ ...base, serverId: "s", mentionsMe: false })).toBe(false)
    expect(shouldNotify({ ...base, serverId: "muted", mentionsMe: true })).toBe(false)
    expect(shouldNotify({ ...base, serverId: null, isDm: true, mentionsMe: true })).toBe(true)
    expect(shouldNotify({ ...base, serverId: null, isDm: true, mentionsMe: true, dnd: true })).toBe(false)
  })
})
