import { describe, expect, it } from "vitest"

import { parseSwitcherQuery, rankSwitcher, switcherKey, type SwitcherItem } from "./quick-switcher"

const channel = (id: string, name: string, extra: Partial<Extract<SwitcherItem, { kind: "channel" }>> = {}): SwitcherItem => ({
  kind: "channel",
  id,
  serverId: "s1",
  serverName: "Lounge",
  name,
  voice: false,
  category: null,
  unread: false,
  mentions: 0,
  ...extra,
})

const items: SwitcherItem[] = [
  channel("c1", "general"),
  channel("c2", "game-night"),
  channel("c3", "off-topic", { unread: true }),
  channel("c4", "announcements", { mentions: 2 }),
  { kind: "dm", id: "d1", title: "Ben", usernames: ["demo_ben"], group: false, unread: false, mentions: 0 },
  { kind: "friend", userId: "u3", name: "Cy", username: "demo_cy", avatarUrl: null },
  { kind: "server", id: "s1", name: "Gaming Lounge", unread: true, mentions: 0 },
]

const keys = (list: SwitcherItem[]) => list.map(switcherKey)

describe("parseSwitcherQuery", () => {
  it("reads scope prefixes", () => {
    expect(parseSwitcherQuery("#Gen")).toEqual({ scope: "channels", text: "gen" })
    expect(parseSwitcherQuery(" @ben ")).toEqual({ scope: "people", text: "ben" })
    expect(parseSwitcherQuery("*")).toEqual({ scope: "servers", text: "" })
    expect(parseSwitcherQuery("lounge")).toEqual({ scope: "all", text: "lounge" })
  })
})

describe("rankSwitcher", () => {
  it("lists mentions, then unread, then recents for an empty query", () => {
    expect(keys(rankSwitcher(items, "", ["d1", "c1"]))).toEqual([
      "channel:c4",
      "channel:c3",
      "server:s1",
      "dm:d1",
      "channel:c1",
    ])
  })

  it("prefers prefix matches, then word starts, then substrings", () => {
    // Both start with "ga"; the unread server wins the tie.
    expect(keys(rankSwitcher(items, "ga"))).toEqual(["server:s1", "channel:c2"])
    expect(keys(rankSwitcher(items, "night"))).toEqual(["channel:c2"])
    expect(keys(rankSwitcher(items, "nera"))).toEqual(["channel:c1"])
  })

  it("matches DMs and friends by username", () => {
    expect(keys(rankSwitcher(items, "demo"))).toEqual(["dm:d1", "friend:u3"])
  })

  it("narrows by scope prefix", () => {
    expect(keys(rankSwitcher(items, "#o"))).toEqual(["channel:c3", "channel:c4"])
    expect(keys(rankSwitcher(items, "@"))).toEqual(["dm:d1", "friend:u3"])
    expect(keys(rankSwitcher(items, "*"))).toEqual(["server:s1"])
  })

  it("breaks ties by attention, then recency", () => {
    const tied = [channel("a", "dev"), channel("b", "design", { unread: true }), channel("c", "docs")]
    expect(keys(rankSwitcher(tied, "d", ["c"]))).toEqual(["channel:b", "channel:c", "channel:a"])
  })

  it("respects the limit", () => {
    expect(rankSwitcher(items, "@", [], 1)).toHaveLength(1)
  })
})
