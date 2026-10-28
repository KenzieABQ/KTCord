import { describe, expect, it } from "vitest"

import { isLive } from "./events"

describe("isLive", () => {
  const now = Date.parse("2026-10-28T12:00:00Z")
  it("is live once started, until it ends", () => {
    expect(isLive({ status: "scheduled", starts_at: "2026-10-28T11:00:00Z", ends_at: null }, now)).toBe(true)
    expect(isLive({ status: "scheduled", starts_at: "2026-10-28T13:00:00Z", ends_at: null }, now)).toBe(false)
    expect(isLive({ status: "scheduled", starts_at: "2026-10-28T10:00:00Z", ends_at: "2026-10-28T11:00:00Z" }, now)).toBe(false)
    expect(isLive({ status: "active", starts_at: "2026-10-28T13:00:00Z", ends_at: null }, now)).toBe(true)
  })
})
