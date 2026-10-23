import { describe, expect, it } from "vitest"

import { formatSlowmode, SLOWMODE_STEPS } from "./slowmode"

describe("formatSlowmode", () => {
  it("reads like Discord's slider", () => {
    expect(SLOWMODE_STEPS.map(formatSlowmode)).toEqual(["Off", "5s", "10s", "15s", "30s", "1m", "2m", "5m", "10m", "15m", "30m", "1h", "2h", "6h"])
  })
})
