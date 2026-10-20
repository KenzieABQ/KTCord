import { describe, expect, it } from "vitest"

import type { Channel } from "@/lib/api/channels"

import {
  applyPlacements,
  buildChannelTree,
  firstTextChannel,
  flattenTree,
  moveCategory,
  placementsFromOrder,
} from "./tree"

let n = 0
function ch(
  id: string,
  type: Channel["type"],
  position: number,
  parent_id: string | null = null
): Channel {
  return {
    id,
    type,
    position,
    parent_id,
    name: id,
    server_id: "s",
    topic: null,
    is_private: false,
    owner_id: null,
    created_at: `2026-01-01T00:00:${String(n++).padStart(2, "0")}Z`,
  }
}

// The default structure create_server() makes, plus an uncategorized channel.
const channels = [
  ch("textcat", "category", 0),
  ch("general", "text", 1, "textcat"),
  ch("voicecat", "category", 2),
  ch("lounge", "voice", 3, "voicecat"),
  ch("rules", "text", 4),
]

describe("buildChannelTree", () => {
  it("puts uncategorized channels first and groups the rest", () => {
    const tree = buildChannelTree(channels)
    expect(tree.uncategorized.map((c) => c.id)).toEqual(["rules"])
    expect(tree.categories.map((g) => [g.category.id, g.channels.map((c) => c.id)])).toEqual([
      ["textcat", ["general"]],
      ["voicecat", ["lounge"]],
    ])
  })

  it("treats channels whose category isn't visible as uncategorized", () => {
    const tree = buildChannelTree([ch("orphan", "text", 0, "hidden-category")])
    expect(tree.uncategorized.map((c) => c.id)).toEqual(["orphan"])
  })

  it("finds the first text channel in sidebar order", () => {
    expect(firstTextChannel(buildChannelTree(channels))?.id).toBe("rules")
  })
})

describe("placementsFromOrder", () => {
  it("re-parents a channel dragged under another category", () => {
    const flat = flattenTree(buildChannelTree(channels)).map((c) => c.id)
    expect(flat).toEqual(["rules", "textcat", "general", "voicecat", "lounge"])

    // Drag #general below "voicecat".
    const order = ["rules", "textcat", "voicecat", "general", "lounge"].map(
      (id) => channels.find((c) => c.id === id)!
    )
    const placements = placementsFromOrder(order)
    const general = placements.find((p) => p.id === "general")
    expect(general).toEqual({ id: "general", position: 3, parent_id: "voicecat" })

    const applied = buildChannelTree(applyPlacements(channels, placements))
    expect(applied.categories[1].channels.map((c) => c.id)).toEqual(["general", "lounge"])
  })

  it("returns nothing when the order is unchanged and positions are already dense", () => {
    const dense = flattenTree(buildChannelTree(channels)).map((c, i) => ({ ...c, position: i }))
    expect(placementsFromOrder(dense)).toEqual([])
  })
})

describe("moveCategory", () => {
  it("moves a category with all of its channels", () => {
    const tree = buildChannelTree(channels)
    const order = moveCategory(tree, "voicecat", 0).map((c) => c.id)
    expect(order).toEqual(["rules", "voicecat", "lounge", "textcat", "general"])
  })
})
