/** What the Ctrl/Cmd+K quick switcher can jump to. */
export type SwitcherItem =
  | {
      kind: "channel"
      id: string
      serverId: string
      serverName: string
      name: string
      voice: boolean
      category: string | null
      unread: boolean
      mentions: number
    }
  | { kind: "dm"; id: string; title: string; usernames: string[]; group: boolean; unread: boolean; mentions: number }
  | { kind: "friend"; userId: string; name: string; username: string; avatarUrl: string | null }
  | { kind: "server"; id: string; name: string; unread: boolean; mentions: number }

/** `#` narrows to channels, `@` to people, `*` to servers, as in Discord. */
export type SwitcherScope = "all" | "channels" | "people" | "servers"

export function parseSwitcherQuery(raw: string): { scope: SwitcherScope; text: string } {
  const trimmed = raw.trimStart()
  const scope: SwitcherScope =
    trimmed[0] === "#" ? "channels" : trimmed[0] === "@" ? "people" : trimmed[0] === "*" ? "servers" : "all"
  const text = (scope === "all" ? trimmed : trimmed.slice(1)).trim().toLowerCase()
  return { scope, text }
}

export function switcherKey(item: SwitcherItem): string {
  return item.kind === "friend" ? `friend:${item.userId}` : `${item.kind}:${item.id}`
}

function inScope(item: SwitcherItem, scope: SwitcherScope) {
  switch (scope) {
    case "all":
      return true
    case "channels":
      return item.kind === "channel"
    case "people":
      return item.kind === "dm" || item.kind === "friend"
    case "servers":
      return item.kind === "server"
  }
}

function names(item: SwitcherItem): string[] {
  switch (item.kind) {
    case "channel":
      return [item.name]
    case "dm":
      return [item.title, ...item.usernames]
    case "friend":
      return [item.name, item.username]
    case "server":
      return [item.name]
  }
}

/** 0: starts with the query, 1: a word starts with it, 2: contains it, null: no match. */
function matchScore(values: string[], text: string): number | null {
  let best: number | null = null
  for (const raw of values) {
    const value = raw.toLowerCase()
    const score = value.startsWith(text)
      ? 0
      : value.split(/[\s\-_.]+/).some((word) => word.startsWith(text))
        ? 1
        : value.includes(text)
          ? 2
          : null
    if (score !== null && (best === null || score < best)) best = score
  }
  return best
}

function attention(item: SwitcherItem): number {
  if (item.kind === "friend") return 0
  return item.mentions > 0 ? 2 : item.unread ? 1 : 0
}

/**
 * Ranks switcher items for a query. With no text, shows what needs attention (mentions,
 * then unread) followed by recently visited channels and DMs. With text, the closest name
 * matches win; ties go to items with mentions or unread messages, then to recent ones.
 */
export function rankSwitcher(
  items: SwitcherItem[],
  query: string,
  recentIds: string[] = [],
  limit = 12
): SwitcherItem[] {
  const { scope, text } = parseSwitcherQuery(query)
  const recency = new Map(recentIds.map((id, i) => [id, i]))
  const recentRank = (item: SwitcherItem) =>
    item.kind === "friend" ? Infinity : (recency.get(item.id) ?? Infinity)

  const scored: { item: SwitcherItem; score: number; index: number }[] = []
  items.forEach((item, index) => {
    if (!inScope(item, scope)) return
    if (!text) {
      // An empty query only lists things worth jumping to.
      const worth = attention(item) > 0 || recentRank(item) !== Infinity || scope !== "all"
      if (worth) scored.push({ item, score: 0, index })
      return
    }
    const score = matchScore(names(item), text)
    if (score !== null) scored.push({ item, score, index })
  })

  return scored
    .sort(
      (a, b) =>
        a.score - b.score ||
        attention(b.item) - attention(a.item) ||
        recentRank(a.item) - recentRank(b.item) ||
        a.index - b.index
    )
    .slice(0, limit)
    .map((s) => s.item)
}
