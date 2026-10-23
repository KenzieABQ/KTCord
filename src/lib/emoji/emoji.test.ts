import { describe, expect, it } from "vitest"

import raw from "./data.json"
import {
  buildEmojiData,
  customEmojiToken,
  decodeEmoji,
  encodeEmoji,
  parseCustomEmoji,
  searchEmoji,
  withSkinTone,
  type CustomEmoji,
} from "./index"

const data = buildEmojiData(raw as Parameters<typeof buildEmojiData>[0])
const ID = "0f8b3b7e-2a5c-4c1e-9f3d-2b6a7c8d9e01"
const OTHER = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d"
const party: CustomEmoji = { id: ID, name: "party_blob", animated: true, serverId: "s1" }

describe("emoji data", () => {
  it("knows Discord-style shortcodes", () => {
    expect(data.byName.get("joy")?.char).toBe("😂")
    // Stored fully qualified (with the emoji variation selector).
    expect(data.byName.get("thumbsup")?.char).toMatch(/^👍/)
    expect(data.byName.get("wave")?.char).toBe("👋")
  })

  it("groups emoji into Discord's categories", () => {
    expect(data.categories.map((c) => c.id)).toEqual(["people", "nature", "food", "activities", "travel", "objects", "symbols", "flags"])
    expect(data.categories[data.byName.get("dog")!.category].id).toBe("nature")
  })

  it("applies skin tones only where they exist", () => {
    const wave = data.byName.get("wave")!
    expect(withSkinTone(wave, 0)).toBe("👋")
    expect(withSkinTone(wave, 5)).toBe("👋🏿")
    expect(withSkinTone(data.byName.get("joy")!, 3)).toBe("😂")
  })
})

describe("searchEmoji", () => {
  it("ranks shortcode matches first", () => {
    expect(searchEmoji(data, "joy")[0].char).toBe("😂")
    expect(searchEmoji(data, ":fire:")[0].char).toBe("🔥")
  })

  it("finds emoji by keyword", () => {
    expect(searchEmoji(data, "hello").map((e) => e.char)).toContain("👋")
    expect(searchEmoji(data, "")).toEqual([])
  })
})

describe("custom emoji tokens", () => {
  it("round-trips", () => {
    expect(customEmojiToken(party)).toBe(`<a:party_blob:${ID}>`)
    expect(parseCustomEmoji(`<a:party_blob:${ID}>`)).toEqual({ animated: true, name: "party_blob", id: ID })
    expect(parseCustomEmoji(`<:party_blob:${ID}> extra`)).toBeNull()
  })
})

describe("encodeEmoji", () => {
  it("turns shortcodes into emoji, preferring custom ones", () => {
    expect(encodeEmoji("hi :wave: :party_blob:", data, [party])).toBe(`hi 👋 <a:party_blob:${ID}>`)
  })

  it("uses the first custom emoji with a name (the open server's)", () => {
    const other = { ...party, id: OTHER, animated: false, serverId: "s2" }
    expect(encodeEmoji(":party_blob:", data, [party, other])).toBe(`<a:party_blob:${ID}>`)
  })

  it("leaves unknown names, times and code alone", () => {
    expect(encodeEmoji("meet at 10:30:00 :nope_not_real:", data, [])).toBe("meet at 10:30:00 :nope_not_real:")
    expect(encodeEmoji("`:joy:` and ```\n:joy:\n```", data, [])).toBe("`:joy:` and ```\n:joy:\n```")
  })

  it("works without the standard set loaded", () => {
    expect(encodeEmoji(":joy: :party_blob:", null, [party])).toBe(`:joy: <a:party_blob:${ID}>`)
  })
})

describe("decodeEmoji", () => {
  it("turns tokens back into names for editing", () => {
    expect(decodeEmoji(`nice <a:party_blob:${ID}> <:ok:${OTHER}>`)).toBe("nice :party_blob: :ok:")
  })
})
