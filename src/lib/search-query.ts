export type HasFilter = "image" | "video" | "file" | "link"

export type ParsedSearch = {
  text: string
  from: string[]
  mentions: string[]
  in: string[]
  has: HasFilter[]
}

const HAS: Record<string, HasFilter> = {
  image: "image",
  images: "image",
  video: "video",
  videos: "video",
  file: "file",
  files: "file",
  attachment: "file",
  link: "link",
  links: "link",
}

/**
 * Splits a Discord-style query into filters and free text:
 * `from:ava has:image in:#general roadmap` → { from: ["ava"], has: ["image"], in: ["general"], text: "roadmap" }.
 * Quoted phrases stay together.
 */
export function parseSearch(input: string): ParsedSearch {
  const out: ParsedSearch = { text: "", from: [], mentions: [], in: [], has: [] }
  const words: string[] = []
  const tokens = input.match(/(\w+:"[^"]*"|"[^"]*"|\S+)/g) ?? []

  for (const token of tokens) {
    const match = token.match(/^(from|mentions|in|has):(.+)$/i)
    if (!match) {
      words.push(token)
      continue
    }
    const key = match[1].toLowerCase()
    const value = match[2].replace(/^"|"$/g, "").replace(/^[@#]/, "").toLowerCase()
    if (!value) continue
    if (key === "has") {
      const has = HAS[value]
      if (has && !out.has.includes(has)) out.has.push(has)
    } else if (key === "from") out.from.push(value)
    else if (key === "mentions") out.mentions.push(value)
    else out.in.push(value)
  }
  out.text = words.join(" ").trim()
  return out
}

export function isEmptySearch(parsed: ParsedSearch) {
  return !parsed.text && !parsed.from.length && !parsed.mentions.length && !parsed.in.length && !parsed.has.length
}
