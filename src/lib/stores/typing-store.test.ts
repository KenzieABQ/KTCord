import { describe, expect, it } from "vitest"

import { describeTyping } from "./typing-store"

describe("describeTyping", () => {
  it("names up to three people, then generalizes", () => {
    expect(describeTyping([])).toBeNull()
    expect(describeTyping(["Ava"])).toBe("Ava is typing…")
    expect(describeTyping(["Ava", "Ben"])).toBe("Ava and Ben are typing…")
    expect(describeTyping(["Ava", "Ben", "Cy"])).toBe("Ava, Ben, and Cy are typing…")
    expect(describeTyping(["Ava", "Ben", "Cy", "Di"])).toBe("Several people are typing…")
  })
})
