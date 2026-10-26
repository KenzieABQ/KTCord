import { describe, expect, it } from "vitest"

import { describeAudit } from "./audit"
import { Permission } from "./permissions"

describe("describeAudit", () => {
  it("names the action and target", () => {
    expect(describeAudit({ action: "member_kick", target_name: "ben", details: {}, reason: null })).toEqual({
      verb: "kicked",
      target: "ben",
      lines: [],
    })
  })

  it("lists field changes readably", () => {
    const { lines } = describeAudit({
      action: "channel_update",
      target_name: "chat",
      details: { name: ["general", "chat"], slowmode: [0, 300], private: [false, true] },
      reason: null,
    })
    expect(lines).toEqual(["Name: general → chat", "Slowmode: Off → 5m", "Private: off → on"])
  })

  it("spells out permission changes", () => {
    const before = Permission.VIEW_CHANNEL | Permission.SEND_MESSAGES
    const after = Permission.VIEW_CHANNEL | Permission.KICK_MEMBERS
    const { lines } = describeAudit({ action: "role_update", target_name: "Mod", details: { permissions: [before, after] }, reason: null })
    expect(lines).toEqual(["Allowed: Kick Members", "Took away: Send Messages"])
  })

  it("includes reasons and overrides", () => {
    expect(describeAudit({ action: "member_ban", target_name: "spammer", details: {}, reason: "spam" }).lines).toEqual(["Reason: spam"])
    expect(
      describeAudit({ action: "overwrite_create", target_name: "general", details: { for: "@everyone", allow: 0, deny: Permission.SEND_MESSAGES }, reason: null }).lines
    ).toEqual(["For: @everyone", "Denied: Send Messages"])
  })

  it("doesn't name a target for server updates", () => {
    expect(describeAudit({ action: "server_update", target_name: "Lounge", details: { name: ["Old", "Lounge"] }, reason: null }).target).toBeNull()
  })
})
