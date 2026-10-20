import { describe, expect, it } from "vitest"

import { combineMetas, usePresenceStore } from "./presence-store"

describe("presence", () => {
  it("prefers DND, then online, then idle across a user's devices", () => {
    expect(combineMetas([{ user_id: "a", status: "idle" }, { user_id: "a", status: "online" }])).toBe("online")
    expect(combineMetas([{ user_id: "a", status: "online" }, { user_id: "a", status: "dnd" }])).toBe("dnd")
    expect(combineMetas([{ user_id: "a", status: "idle" }])).toBe("idle")
    expect(combineMetas([])).toBeNull()
  })

  it("groups presence state by user id", () => {
    usePresenceStore.getState().sync({
      k1: [{ user_id: "a", status: "idle" }],
      k2: [{ user_id: "a", status: "online" }, { user_id: "b", status: "dnd" }],
    })
    expect(usePresenceStore.getState().byUser).toEqual({ a: "online", b: "dnd" })
  })
})
