import { outsideCode } from "@/lib/mentions"
import { SUPABASE_URL } from "@/lib/supabase/env"

export type EmojiCategory = { id: string; label: string }

/** One standard emoji: the character, its shortcode names (first is the main one), and search words. */
export type EmojiEntry = {
  char: string
  names: string[]
  category: number
  keywords: string
  /** Variants for the five skin tones, light to dark. */
  skins?: string[]
}

export type EmojiData = {
  categories: EmojiCategory[]
  emoji: EmojiEntry[]
  byName: Map<string, EmojiEntry>
  byChar: Map<string, EmojiEntry>
}

type RawData = { categories: EmojiCategory[]; emoji: [string, string[], number, string, string[]?][] }

/** Builds the lookup tables from the generated data file (see scripts/build-emoji-data.mjs). */
export function buildEmojiData(raw: RawData): EmojiData {
  const emoji = raw.emoji.map(([char, names, category, keywords, skins]) => ({ char, names, category, keywords, skins }))
  const byName = new Map<string, EmojiEntry>()
  const byChar = new Map<string, EmojiEntry>()
  for (const entry of emoji) {
    for (const name of entry.names) if (!byName.has(name)) byName.set(name, entry)
    byChar.set(entry.char, entry)
    for (const skin of entry.skins ?? []) byChar.set(skin, entry)
  }
  return { categories: raw.categories, emoji, byName, byChar }
}

let loading: Promise<EmojiData> | null = null

/** The emoji set, loaded on first use (about 56 KB gzipped) and then cached. */
export function loadEmojiData(): Promise<EmojiData> {
  loading ??= import("./data.json").then((m) => buildEmojiData(m.default as unknown as RawData))
  return loading
}

export const SKIN_TONES = ["Default", "Light", "Medium-Light", "Medium", "Medium-Dark", "Dark"] as const

/** The emoji in a skin tone (0 = default yellow, 1–5 light to dark) when it has tone variants. */
export function withSkinTone(entry: EmojiEntry, tone: number): string {
  return tone > 0 && entry.skins ? entry.skins[tone - 1] : entry.char
}

/** Standard emoji matching a search, best first: exact name, name prefix, name substring, then keywords. */
export function searchEmoji(data: EmojiData, query: string, limit = 120): EmojiEntry[] {
  const q = query.trim().toLowerCase().replace(/^:|:$/g, "").replace(/\s+/g, "_")
  if (!q) return []
  const words = q.replace(/_/g, " ")
  const scored: { entry: EmojiEntry; score: number }[] = []
  for (const entry of data.emoji) {
    let score = -1
    if (entry.names.includes(q)) score = 0
    else if (entry.names.some((n) => n.startsWith(q))) score = 1
    else if (entry.names.some((n) => n.includes(q))) score = 2
    else if (entry.keywords.split(" ").some((k) => k.startsWith(words))) score = 3
    else if (entry.keywords.includes(words)) score = 4
    if (score >= 0) scored.push({ entry, score })
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.entry)
}

// ---------------------------------------------------------------------------
// Custom server emoji
// ---------------------------------------------------------------------------

export type CustomEmoji = { id: string; name: string; animated: boolean; serverId: string }

const TOKEN = /<(a?):([A-Za-z0-9_]{2,32}):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})>/
const TOKEN_GLOBAL = new RegExp(TOKEN.source, "g")

/** How a custom emoji is written in messages and reactions: <:name:id>, or <a:name:id> when animated. */
export function customEmojiToken(emoji: Pick<CustomEmoji, "id" | "name" | "animated">): string {
  return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`
}

/** The parts of a custom emoji token, or null when `value` isn't exactly one. */
export function parseCustomEmoji(value: string): { animated: boolean; name: string; id: string } | null {
  const m = new RegExp(`^${TOKEN.source}$`).exec(value)
  return m ? { animated: m[1] === "a", name: m[2], id: m[3] } : null
}

/** Public image URL for a custom emoji (images are stored at their id). */
export function customEmojiUrl(id: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/emojis/${id}`
}

/**
 * Turns :name: into emoji before a message is sent, as Discord does: a custom emoji you
 * can use (the open server's first), otherwise a standard emoji with that shortcode.
 * Unknown names and anything inside code stay as typed.
 */
export function encodeEmoji(text: string, data: EmojiData | null, custom: CustomEmoji[]): string {
  const customByName = new Map<string, CustomEmoji>()
  for (const emoji of custom) if (!customByName.has(emoji.name.toLowerCase())) customByName.set(emoji.name.toLowerCase(), emoji)
  return outsideCode(text, (part) =>
    part.replace(/(^|[^<a-zA-Z0-9_]):([A-Za-z0-9_+-]{2,32}):/g, (match, before: string, name: string) => {
      const mine = customByName.get(name.toLowerCase())
      if (mine) return before + customEmojiToken(mine)
      const standard = data?.byName.get(name.toLowerCase())
      return standard ? before + standard.char : match
    })
  )
}

/** Turns custom emoji tokens back into :name: for editing. */
export function decodeEmoji(text: string): string {
  return text.replace(TOKEN_GLOBAL, (_m, _a, name: string) => `:${name}:`)
}
