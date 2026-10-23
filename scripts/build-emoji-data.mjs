/**
 * Builds src/lib/emoji/data.json from emojibase-data: the emoji the picker offers, grouped
 * into Discord's categories, with Slack/Discord-style shortcodes (:joy:, :wave:) and search
 * keywords. Emoji newer than Unicode 15.1 are left out because many devices can't draw them yet.
 *
 *   node scripts/build-emoji-data.mjs
 */
import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const data = require("emojibase-data/en/data.json")
const shortcodes = require("emojibase-data/en/shortcodes/iamcal.json")
const fallback = require("emojibase-data/en/shortcodes/emojibase.json")

const MAX_VERSION = 15.1

// emojibase groups → Discord's picker categories (Smileys and People are one category there).
const CATEGORY_BY_GROUP = { 0: "people", 1: "people", 3: "nature", 4: "food", 5: "travel", 6: "activities", 7: "objects", 8: "symbols", 9: "flags" }
const CATEGORIES = [
  { id: "people", label: "People" },
  { id: "nature", label: "Nature" },
  { id: "food", label: "Food" },
  { id: "activities", label: "Activities" },
  { id: "travel", label: "Travel" },
  { id: "objects", label: "Objects" },
  { id: "symbols", label: "Symbols" },
  { id: "flags", label: "Flags" },
]

const codesOf = (hexcode) => {
  const value = shortcodes[hexcode] ?? fallback[hexcode]
  return value ? (Array.isArray(value) ? value : [value]) : []
}

const slug = (label) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")

const emoji = data
  .filter((e) => e.group in CATEGORY_BY_GROUP && e.version <= MAX_VERSION)
  .sort((a, b) => a.order - b.order)
  .map((e) => {
    const codes = codesOf(e.hexcode)
    const names = [...new Set([...codes, slug(e.label)])]
    const keywords = [...new Set([e.label.toLowerCase(), ...(e.tags ?? [])])].join(" ")
    const skins = e.skins?.filter((s) => typeof s.tone === "number" && s.version <= MAX_VERSION).map((s) => s.emoji)
    // [character, shortcode names, category index, search keywords, skin tone variants?]
    const row = [e.emoji, names, CATEGORIES.findIndex((c) => c.id === CATEGORY_BY_GROUP[e.group]), keywords]
    if (skins?.length === 5) row.push(skins)
    return row
  })

const out = { categories: CATEGORIES, emoji }
const path = new URL("../src/lib/emoji/data.json", import.meta.url)
writeFileSync(path, JSON.stringify(out))
console.log(`Wrote ${emoji.length} emoji (${Math.round(readFileSync(path).length / 1024)} KB)`)
