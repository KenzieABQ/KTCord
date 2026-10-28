import { describe, expect, it } from "vitest"

import { vanityProblem } from "./community-settings"

describe("vanityProblem", () => {
  it("accepts codes the database accepts", () => {
    expect(vanityProblem("ktcord")).toBeNull()
    expect(vanityProblem("cool-club-2")).toBeNull()
    expect(vanityProblem("")).toBeNull()
  })
  it("explains what's wrong", () => {
    expect(vanityProblem("Caps")).toMatch("lowercase")
    expect(vanityProblem("ab")).toMatch("3 to 32")
    expect(vanityProblem("-dash")).toMatch("dash")
  })
})
