/**
 * Discord-flavored markdown → a small AST. No HTML is ever produced from user input;
 * the renderer turns these nodes into React elements.
 *
 * Supported: **bold**, *italic* / _italic_, __underline__, ~~strike~~, ||spoiler||,
 * `inline code`, ```fenced code```, > quotes, >>> rest-of-message quotes,
 * # headings (#, ##, ###), -# subtext, - bulleted and 1. numbered lists (indent to nest),
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
  | { type: "heading"; level: 1 | 2 | 3; children: MdNode[] }
  | { type: "subtext"; children: MdNode[] }
  | { type: "list"; ordered: boolean; start: number; items: MdNode[][] }
  | { type: "link"; url: string; children: MdNode[]; suppressEmbed?: true }
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
    build: (m) => ({ type: "link", url: m[1], children: [{ type: "text", value: m[1] }], suppressEmbed: true }),
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

const HEADING = /^(#{1,3}) +(\S.*)$/
const SUBTEXT = /^-# +(\S.*)$/
const LIST_ITEM = /^( *)(?:[-*]|(\d{1,9})\.) +(\S.*)$/

type ListLine = { indent: number; ordered: boolean; number: number; lines: string[] }

/** Nodes that render as their own block, so no line break is needed around them. */
function isBlock(node: MdNode | undefined) {
  return (
    node?.type === "codeBlock" ||
    node?.type === "blockquote" ||
    node?.type === "heading" ||
    node?.type === "subtext" ||
    node?.type === "list"
  )
}

/**
 * Turns list lines into lists: deeper-indented items nest under the item above them, and
 * switching between bullets and numbers at the same level starts a new list.
 */
function buildLists(items: ListLine[], depth: number): MdNode[] {
  const lists: MdNode[] = []
  let i = 0
  while (i < items.length) {
    const first = items[i]
    const list: Extract<MdNode, { type: "list" }> = {
      type: "list",
      ordered: first.ordered,
      start: first.number,
      items: [],
    }
    while (i < items.length && items[i].ordered === first.ordered) {
      const item = items[i]
      let end = i + 1
      while (end < items.length && items[end].indent > item.indent) end++
      const children = parseInline(item.lines.join("\n"), depth)
      if (end > i + 1) children.push(...buildLists(items.slice(i + 1, end), depth + 1))
      list.items.push(children)
      i = end
    }
    lists.push(list)
  }
  return lists
}

/** Line-level markdown inside one run of lines: headings, subtext and lists, with text between. */
function parseLines(lines: string[], depth: number): MdNode[] {
  const out: MdNode[] = []
  let plain: string[] = []
  let items: ListLine[] = []

  const flushPlain = () => {
    if (plain.length === 0) return
    out.push(...parseInline(plain.join("\n"), depth))
    plain = []
  }
  const flushList = () => {
    if (items.length === 0) return
    out.push(...buildLists(items, depth))
    items = []
  }

  for (const line of lines) {
    let m = LIST_ITEM.exec(line)
    if (m && !SUBTEXT.test(line)) {
      flushPlain()
      items.push({ indent: m[1].length, ordered: m[2] !== undefined, number: m[2] ? Number(m[2]) : 1, lines: [m[3]] })
      continue
    }
    // An indented line right after a list item continues that item.
    if (items.length && /^ {2,}\S/.test(line)) {
      items[items.length - 1].lines.push(line.trim())
      continue
    }
    flushList()
    if ((m = HEADING.exec(line))) {
      flushPlain()
      out.push({ type: "heading", level: m[1].length as 1 | 2 | 3, children: parseInline(m[2], depth) })
    } else if ((m = SUBTEXT.exec(line))) {
      flushPlain()
      out.push({ type: "subtext", children: parseInline(m[1], depth) })
    } else {
      plain.push(line)
    }
  }
  flushList()
  flushPlain()
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
    out.push(...parseLines(plain, depth))
    plain = []
  }
  const flushQuote = () => {
    if (quoted.length === 0) return
    out.push({ type: "blockquote", children: parseLines(quoted, depth) })
    quoted = []
  }
  const endPlain = () => {
    if (plain.length === 0) return
    flushPlain()
    if (!isBlock(out[out.length - 1])) out.push({ type: "br" })
  }

  for (let n = 0; n < lines.length; n++) {
    const line = lines[n]
    if (line.startsWith(">>> ")) {
      flushQuote()
      endPlain()
      quoted = [line.slice(4), ...lines.slice(n + 1)]
      flushQuote()
      return out
    }
    if (line.startsWith("> ") || line === ">") {
      endPlain()
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

type Names = { user?: (id: string) => string; role?: (id: string) => string; channel?: (id: string) => string }

function plainOf(node: MdNode, names?: Names): string {
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
    case "list":
      return node.items.map((item) => toPlainText(item, names)).join(" ")
    default:
      return toPlainText(node.children, names)
  }
}

/** Plain text for previews (reply bars, notifications, search results). */
export function toPlainText(nodes: MdNode[], names?: Names): string {
  let out = ""
  nodes.forEach((node, i) => {
    // Blocks sit on their own lines; keep a space between them and their neighbors.
    if (i > 0 && (isBlock(node) || isBlock(nodes[i - 1])) && !out.endsWith(" ")) out += " "
    out += plainOf(node, names)
  })
  return out
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
