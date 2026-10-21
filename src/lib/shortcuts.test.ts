import { describe, expect, it } from "vitest"

import { adjacentId, formatKey, isPrintableKey } from "./shortcuts"

describe("adjacentId", () => {
  const ids = ["a", "b", "c", "d"]

  it("steps forward and back, wrapping around", () => {
    expect(adjacentId(ids, "b", 1)).toBe("c")
    expect(adjacentId(ids, "d", 1)).toBe("a")
    expect(adjacentId(ids, "a", -1)).toBe("d")
  })

  it("starts at an end when the current id isn't listed", () => {
    expect(adjacentId(ids, undefined, 1)).toBe("a")
    expect(adjacentId(ids, "zz", -1)).toBe("d")
  })

  it("skips ids that don't qualify", () => {
    const unread = new Set(["a", "c"])
    expect(adjacentId(ids, "a", 1, (id) => unread.has(id))).toBe("c")
    expect(adjacentId(ids, "c", 1, (id) => unread.has(id))).toBe("a")
    expect(adjacentId(ids, "b", -1, (id) => unread.has(id))).toBe("a")
  })

  it("returns undefined when there's nowhere to go", () => {
    expect(adjacentId([], undefined, 1)).toBeUndefined()
    expect(adjacentId(["a"], "a", 1)).toBeUndefined()
    expect(adjacentId(ids, "a", 1, () => false)).toBeUndefined()
  })
})

describe("formatKey", () => {
  it("uses platform symbols", () => {
    expect(formatKey("Mod", true)).toBe("⌘")
    expect(formatKey("Mod", false)).toBe("Ctrl")
    expect(formatKey("K", true)).toBe("K")
  })
})

describe("isPrintableKey", () => {
  const key = (k: string, mods: Partial<KeyboardEvent> = {}) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, ...mods })

  it("accepts plain characters only", () => {
    expect(isPrintableKey(key("a"))).toBe(true)
    expect(isPrintableKey(key("?"))).toBe(true)
    expect(isPrintableKey(key(" "))).toBe(false)
    expect(isPrintableKey(key("Enter"))).toBe(false)
    expect(isPrintableKey(key("k", { metaKey: true }))).toBe(false)
  })
})
