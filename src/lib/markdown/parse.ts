/**
 * Discord-flavored markdown → a small AST. No HTML is ever produced from user input;
 * the renderer turns these nodes into React elements.
 *
 * Supported: **bold**, *italic* / _italic_, __underline__, ~~strike~~, ||spoiler||,
 * `inline code`, ```fenced code```, > quotes, >>> rest-of-message quotes,
 * [masked](https://links), autolinked URLs, <https://suppressed>, \escapes,
 * <@user>, <@&role>, <#channel>, <:custom_emoji:id>, @everyone and @here.
 */

export type MdNode =
  | { type: "text"; value: string }
  | { type: "br" }
  | { type: "strong" | "em" | "underline" | "strike" | "spoiler"; children: MdNode[] }
  | { type: "inlineCode"; value: string }
  | { type: "codeBlock"; lang: string | null; value: string }
  | { type: "blockquote"; children: MdNode[] }
  | { type: "link"; url: string; children: MdNode[] }
  | { type: "mention"; kind: "user" | "role" | "channel"; id: string }
  | { type: "everyone"; value: "everyone" | "here" }
  | { type: "customEmoji"; name: string; id: string; animated: boolean }

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
const MAX_DEPTH = 6

type Rule = {
  re: RegExp
  /** Optional check on the character before the match (for word-boundary rules). */
  before?: (prev: string) => boolean
  build: (m: RegExpExecArray, depth: number) => MdNode
}

const isWordChar = (c: string) => /[\p{L}\p{N}_]/u.test(c)

function nested(type: "strong" | "em" | "underline" | "strike" | "spoiler") {
  return (m: RegExpExecArray, depth: number): MdNode => ({
    type,
    children: parseInline(m[1], depth + 1),
  })
}

// Order matters: longer delimiters first (** before *, __ before _).
const RULES: Rule[] = [
  { re: /\\([\\`*_~|<>@#[\]()>-])/y, build: (m) => ({ type: "text", value: m[1] }) },
  {
    re: /(`+)([\s\S]*?[^`])\1(?!`)/y,
    build: (m) => ({ type: "inlineCode", value: m[2].replace(/^ ([\s\S]*) $/, "$1") }),
  },
  { re: /\|\|([\s\S]+?)\|\|/y, build: nested("spoiler") },
  { re: /\*\*([\s\S]+?)\*\*(?!\*)/y, build: nested("strong") },
  { re: /__([\s\S]+?)__(?!_)/y, build: nested("underline") },
  { re: /\*(?=\S)([\s\S]*?\S)\*(?!\*)/y, build: nested("em") },
  {
    re: /_((?:__|\\[\s\S]|[^\\_])+?)_(?![\p{L}\p{N}_])/uy,
    before: (prev) => !isWordChar(prev),
    build: nested("em"),
  },
  { re: /~~([\s\S]+?)~~/y, build: nested("strike") },
  {
    re: /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/y,
    build: (m, depth) => ({ type: "link", url: m[2], children: parseInline(m[1], depth + 1) }),
  },
  {
    re: /<(https?:\/\/[^\s>]+)>/y,
    build: (m) => ({ type: "link", url: m[1], children: [{ type: "text", value: m[1] }] }),
  },
  {
    // Trailing punctuation stays outside the link, as in "see https://x.y."
    re: /https?:\/\/[^\s<]*[^\s<.,:;"'\]!?)]/y,
    build: (m) => ({ type: "link", url: m[0], children: [{ type: "text", value: m[0] }] }),
  },
  { re: new RegExp(`<@!?(${UUID})>`, "y"), build: (m) => ({ type: "mention", kind: "user", id: m[1] }) },
  { re: new RegExp(`<@&(${UUID})>`, "y"), build: (m) => ({ type: "mention", kind: "role", id: m[1] }) },
  { re: new RegExp(`<#(${UUID})>`, "y"), build: (m) => ({ type: "mention", kind: "channel", id: m[1] }) },
  {
    re: new RegExp(`<(a?):([A-Za-z0-9_]{2,32}):(${UUID})>`, "y"),
    build: (m) => ({ type: "customEmoji", animated: m[1] === "a", name: m[2], id: m[3] }),
  },
  {
    re: /@(everyone|here)(?![\p{L}\p{N}_])/uy,
    before: (prev) => !isWordChar(prev),
    build: (m) => ({ type: "everyone", value: m[1] as "everyone" | "here" }),
  },
]

// Characters that can start a rule; anything else is plain text.
const PLAIN_RUN = /[^\\`|*_~[<h@\n]+/y

function pushText(out: MdNode[], value: string) {
  const last = out[out.length - 1]
  if (last?.type === "text") last.value += value
  else out.push({ type: "text", value })
}

export function parseInline(src: string, depth = 0): MdNode[] {
  const out: MdNode[] = []
  if (depth > MAX_DEPTH) {
    pushText(out, src)
    return out
  }

  let i = 0
  outer: while (i < src.length) {
    if (src[i] === "\n") {
      out.push({ type: "br" })
      i++
      continue
    }
    for (const rule of RULES) {
      if (rule.before && i > 0 && !rule.before(src[i - 1])) continue
      rule.re.lastIndex = i
      const m = rule.re.exec(src)
      if (m) {
        const node = rule.build(m, depth)
        if (node.type === "text") pushText(out, node.value)
        else out.push(node)
        i += m[0].length
        continue outer
      }
    }
    PLAIN_RUN.lastIndex = i
    const run = PLAIN_RUN.exec(src)
    const text = run ? run[0] : src[i]
    pushText(out, text)
    i += text.length
  }
  return out
}

/** Splits non-code text into quoted and unquoted runs of lines. */
function parseQuotes(text: string, depth: number): MdNode[] {
  const out: MdNode[] = []
  const lines = text.split("\n")
  let plain: string[] = []
  let quoted: string[] = []

  const flushPlain = () => {
    if (plain.length === 0) return
    const inline = parseInline(plain.join("\n"), depth)
    out.push(...inline)
    plain = []
  }
  const flushQuote = () => {
    if (quoted.length === 0) return
    out.push({ type: "blockquote", children: parseInline(quoted.join("\n"), depth) })
    quoted = []
  }

  for (let n = 0; n < lines.length; n++) {
    const line = lines[n]
    if (line.startsWith(">>> ")) {
      flushQuote()
      if (plain.length) {
        flushPlain()
        out.push({ type: "br" })
      }
      quoted = [line.slice(4), ...lines.slice(n + 1)]
      flushQuote()
      return out
    }
    if (line.startsWith("> ") || line === ">") {
      if (plain.length) {
        flushPlain()
        out.push({ type: "br" })
      }
      quoted.push(line.slice(2))
    } else {
      // A quote ends at the first unquoted line; that line starts a new plain run.
      flushQuote()
      plain.push(line)
    }
  }
  flushQuote()
  flushPlain()
  return out
}

const FENCE = /```(?:([\w+#.-]+)\n)?\n?([\s\S]*?)```/g

export function parseMarkdown(src: string): MdNode[] {
  const out: MdNode[] = []
  let last = 0
  for (const m of src.matchAll(FENCE)) {
    const before = src.slice(last, m.index)
    if (before) out.push(...parseQuotes(before.replace(/\n$/, ""), 0))
    out.push({ type: "codeBlock", lang: m[1] ?? null, value: m[2].replace(/\n$/, "") })
    last = m.index + m[0].length
    // Swallow the newline right after a fence; the block already breaks the line.
    if (src[last] === "\n") last++
  }
  const rest = src.slice(last)
  if (rest) out.push(...parseQuotes(rest, 0))
  return out
}

/** Plain text for previews (reply bars, notifications, search results). */
export function toPlainText(nodes: MdNode[], names?: { user?: (id: string) => string; role?: (id: string) => string; channel?: (id: string) => string }): string {
  return nodes
    .map((node): string => {
      switch (node.type) {
        case "text":
          return node.value
        case "br":
          return " "
        case "inlineCode":
        case "codeBlock":
          return node.value
        case "mention":
          if (node.kind === "user") return `@${names?.user?.(node.id) ?? "unknown-user"}`
          if (node.kind === "role") return `@${names?.role?.(node.id) ?? "deleted-role"}`
          return `#${names?.channel?.(node.id) ?? "unknown-channel"}`
        case "everyone":
          return `@${node.value}`
        case "customEmoji":
          return `:${node.name}:`
        case "spoiler":
          return "▇▇▇▇"
        default:
          return toPlainText(node.children, names)
      }
    })
    .join("")
}

/** True when the message is only emoji (up to 27), which Discord shows larger. */
export function isEmojiOnly(src: string): boolean {
  const trimmed = src.trim()
  if (!trimmed || trimmed.length > 2000) return false
  // Custom emoji count as one emoji each.
  const tokens = trimmed.match(new RegExp(`<a?:[A-Za-z0-9_]{2,32}:${UUID}>`, "g")) ?? []
  const stripped = trimmed.replace(new RegExp(`<a?:[A-Za-z0-9_]{2,32}:${UUID}>`, "g"), "").replace(/\s+/g, "")
  if (!stripped) return tokens.length > 0 && tokens.length <= 27
  const emoji = stripped.match(/\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*|\p{Regional_Indicator}{2}/gu)
  return Boolean(emoji) && emoji!.join("") === stripped && emoji!.length + tokens.length <= 27
}
