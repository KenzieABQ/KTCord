import { describe, expect, it } from "vitest"

import { registerSchema, usernameSchema } from "./validation"

describe("usernameSchema", () => {
  it("lowercases and trims", () => {
    expect(usernameSchema.parse("  Kenzie_01 ")).toBe("kenzie_01")
  })

  it.each([
    ["a", "Must be at least 2 characters"],
    ["x".repeat(33), "Must be 32 characters or fewer"],
    ["has space", "Use only letters, numbers, underscores and periods"],
    ["emoji😀", "Use only letters, numbers, underscores and periods"],
    ["two..dots", "Can't contain two periods in a row"],
  ])("rejects %j", (input, message) => {
    const result = usernameSchema.safeParse(input)
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((i) => i.message)).toContain(message)
  })

  it("accepts periods and underscores", () => {
    expect(usernameSchema.safeParse("k.t_cord").success).toBe(true)
  })
})

describe("registerSchema", () => {
  it("reports every invalid field at once", () => {
    const result = registerSchema.safeParse({
      email: "",
      displayName: "",
      username: "",
      password: "",
    })
    const paths = new Set(result.error?.issues.map((i) => i.path[0]))
    expect(paths).toEqual(new Set(["email", "username", "password"]))
  })

  it("allows an empty display name", () => {
    const result = registerSchema.safeParse({
      email: "a@b.co",
      displayName: "",
      username: "abc",
      password: "longenough",
    })
    expect(result.success).toBe(true)
  })
})
