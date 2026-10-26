import { describe, expect, it } from "vitest"

import { AUTOMOD_KEYWORD_MAX_LENGTH, parseWordList } from "./automod"

describe("parseWordList", () => {
  it("splits on commas and newlines, trimming and dropping blanks", () => {
    expect(parseWordList("cat, dog\n\n  bird  ,").words).toEqual(["cat", "dog", "bird"])
  })

  it("keeps wildcards and phrases but drops repeats and bare asterisks", () => {
    expect(parseWordList("cat*, *dog*, bad   word, CAT*, *, **").words).toEqual(["cat*", "*dog*", "bad word"])
  })

  it("reports a word that's too long", () => {
    const long = "a".repeat(AUTOMOD_KEYWORD_MAX_LENGTH + 1)
    expect(parseWordList(`ok, ${long}`).tooLong).toBe(long)
    expect(parseWordList("ok").tooLong).toBeNull()
  })
})
