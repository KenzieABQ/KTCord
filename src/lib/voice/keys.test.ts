import { describe, expect, it } from "vitest"

import { formatKeyCode, isNonTypingKey } from "./keys"

describe("formatKeyCode", () => {
  it("names keys the way they're printed", () => {
    expect(formatKeyCode("Backquote")).toBe("`")
    expect(formatKeyCode("KeyV")).toBe("V")
    expect(formatKeyCode("Digit4")).toBe("4")
    expect(formatKeyCode("ShiftLeft")).toBe("Left Shift")
    expect(formatKeyCode("Numpad0")).toBe("Num 0")
    expect(formatKeyCode("PageDown")).toBe("Page Down")
  })
})

describe("isNonTypingKey", () => {
  it("separates modifiers and function keys from typing keys", () => {
    expect(isNonTypingKey("ShiftRight")).toBe(true)
    expect(isNonTypingKey("F13")).toBe(true)
    expect(isNonTypingKey("CapsLock")).toBe(true)
    expect(isNonTypingKey("KeyV")).toBe(false)
    expect(isNonTypingKey("Backquote")).toBe(false)
    expect(isNonTypingKey("Space")).toBe(false)
  })
})
