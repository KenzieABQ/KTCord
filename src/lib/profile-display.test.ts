import { describe, expect, it } from "vitest"

import { initialsOf, luminance, themeIsLight } from "./profile-display"

describe("luminance", () => {
  it("spans black to white", () => {
    expect(luminance("#000000")).toBe(0)
    expect(luminance("#ffffff")).toBeCloseTo(1)
    expect(luminance("#5865f2")).toBeGreaterThan(0.1)
  })
})

describe("themeIsLight", () => {
  it("picks dark text only for light themes", () => {
    expect(themeIsLight("#fde047", "#fef9c3")).toBe(true)
    expect(themeIsLight("#5865f2", "#1e1f22")).toBe(false)
    expect(themeIsLight("#0b0c0e", "#2b2d31")).toBe(false)
  })
})

describe("initialsOf", () => {
  it("uses up to two initials", () => {
    expect(initialsOf("Ava Lee")).toBe("AL")
    expect(initialsOf("ben")).toBe("BE")
  })
})
