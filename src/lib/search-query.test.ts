import { describe, expect, it } from "vitest"

import { isEmptySearch, parseSearch } from "./search-query"

describe("parseSearch", () => {
  it("separates filters from words", () => {
    expect(parseSearch("from:Ava has:image in:#general the roadmap")).toEqual({
      text: "the roadmap",
      from: ["ava"],
      mentions: [],
      in: ["general"],
      has: ["image"],
    })
  })

  it("keeps quoted phrases and ignores unknown has: values", () => {
    const parsed = parseSearch('"release notes" has:links has:pizza mentions:@ben')
    expect(parsed.text).toBe('"release notes"')
    expect(parsed.has).toEqual(["link"])
    expect(parsed.mentions).toEqual(["ben"])
  })

  it("treats unknown keys as words", () => {
    expect(parseSearch("before:2024 hello").text).toBe("before:2024 hello")
  })

  it("knows when nothing was asked", () => {
    expect(isEmptySearch(parseSearch("   "))).toBe(true)
    expect(isEmptySearch(parseSearch("has:file"))).toBe(false)
  })
})
