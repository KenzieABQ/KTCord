/**
 * The composer shows readable mentions ("@ava", "@Moderators", "#general"); messages store
 * tokens ("<@id>", "<@&id>", "<#id>") so renames don't break them. These convert both ways
 * and leave code spans and code blocks untouched.
 */

export type MentionUser = { id: string; username: string; name: string }
export type MentionRole = { id: string; name: string }
export type MentionChannel = { id: string; name: string }

export type MentionSources = {
  users: MentionUser[]
  roles: MentionRole[]
  channels: MentionChannel[]
}

const CODE = /(```[\s\S]*?```|`[^`\n]*`)/

/** Applies `fn` to the parts of `text` outside code. */
function outsideCode(text: string, fn: (part: string) => string): string {
  return text
    .split(CODE)
    .map((part, i) => (i % 2 === 1 ? part : fn(part)))
    .join("")
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const TRAILING_PUNCT = /[.,!?:;]+$/

export function encodeMentions(text: string, sources: MentionSources): string {
  const byUsername = new Map(sources.users.map((u) => [u.username.toLowerCase(), u]))
  const byChannel = new Map(sources.channels.map((c) => [c.name.toLowerCase(), c]))
  const roles = [...sources.roles].sort((a, b) => b.name.length - a.name.length)

  return outsideCode(text, (part) => {
    // Users: @username (lowercase letters, digits, _ and .). Trailing punctuation isn't part of it.
    let out = part.replace(/(^|[^\w@<])@([A-Za-z0-9_.]{2,32})/g, (match, before: string, raw: string) => {
      let candidate = raw
      let tail = ""
      while (candidate && !byUsername.has(candidate.toLowerCase())) {
        const trimmed = candidate.replace(/\.$/, "")
        if (trimmed === candidate) break
        tail = "." + tail
        candidate = trimmed
      }
      const user = byUsername.get(candidate.toLowerCase())
      return user ? `${before}<@${user.id}>${tail}${raw.slice(candidate.length + tail.length)}` : match
    })

    // Roles: names can have spaces, so match the longest names first.
    for (const role of roles) {
      if (/^(everyone|here)$/i.test(role.name)) continue
      out = out.replace(
        new RegExp(`(^|[^\\w<])@${escapeRe(role.name)}(?![\\p{L}\\p{N}_])`, "gu"),
        (_m, before: string) => `${before}<@&${role.id}>`
      )
    }

    // Channels: #name.
    return out.replace(/(^|[^\w<&])#([^\s#<>@]+)/g, (match, before: string, raw: string) => {
      const name = raw.replace(TRAILING_PUNCT, "")
      const channel = byChannel.get(name.toLowerCase())
      return channel ? `${before}<#${channel.id}>${raw.slice(name.length)}` : match
    })
  })
}

export function decodeMentions(text: string, sources: MentionSources): string {
  const users = new Map(sources.users.map((u) => [u.id, u]))
  const roles = new Map(sources.roles.map((r) => [r.id, r]))
  const channels = new Map(sources.channels.map((c) => [c.id, c]))
  return outsideCode(text, (part) =>
    part
      .replace(/<@!?([0-9a-fA-F-]{36})>/g, (m, id: string) => (users.has(id) ? `@${users.get(id)!.username}` : m))
      .replace(/<@&([0-9a-fA-F-]{36})>/g, (m, id: string) => (roles.has(id) ? `@${roles.get(id)!.name}` : m))
      .replace(/<#([0-9a-fA-F-]{36})>/g, (m, id: string) => (channels.has(id) ? `#${channels.get(id)!.name}` : m))
  )
}

export type MentionTrigger = { kind: "@" | "#"; query: string; start: number }

/** The "@que" or "#gen" being typed right before the caret, if any. */
export function findTrigger(text: string, caret: number): MentionTrigger | null {
  const before = text.slice(0, caret)
  const match = before.match(/(^|[\s(])([@#])([^\s@#<>]{0,32})$/)
  if (!match) return null
  const start = before.length - match[3].length - 1
  return { kind: match[2] as "@" | "#", query: match[3], start }
}

/** Ranks candidates: prefix matches first, then substring matches. */
export function rankMatches<T>(items: T[], query: string, keys: (item: T) => string[], limit = 8): T[] {
  const q = query.toLowerCase()
  const scored: { item: T; score: number }[] = []
  for (const item of items) {
    const values = keys(item).map((k) => k.toLowerCase())
    if (!q) scored.push({ item, score: 1 })
    else if (values.some((v) => v.startsWith(q))) scored.push({ item, score: 0 })
    else if (values.some((v) => v.includes(q))) scored.push({ item, score: 1 })
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.item)
}
