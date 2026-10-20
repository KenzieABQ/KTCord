import type { Channel, ChannelPlacement } from "@/lib/api/channels"

export type CategoryGroup = { category: Channel; channels: Channel[] }

/** Server channels as the sidebar shows them: uncategorized first, then each category with its channels. */
export type ChannelTree = {
  uncategorized: Channel[]
  categories: CategoryGroup[]
}

const byPosition = (a: Channel, b: Channel) =>
  a.position - b.position || a.created_at.localeCompare(b.created_at)

export function buildChannelTree(channels: Channel[]): ChannelTree {
  const sorted = [...channels].sort(byPosition)
  const categories = sorted.filter((c) => c.type === "category")
  const categoryIds = new Set(categories.map((c) => c.id))
  const children = new Map<string, Channel[]>(categories.map((c) => [c.id, []]))
  const uncategorized: Channel[] = []

  for (const channel of sorted) {
    if (channel.type === "category") continue
    if (channel.parent_id && categoryIds.has(channel.parent_id)) {
      children.get(channel.parent_id)!.push(channel)
    } else {
      // Parent missing or not visible (e.g. a private category): show it at the top.
      uncategorized.push(channel)
    }
  }

  return {
    uncategorized,
    categories: categories.map((category) => ({
      category,
      channels: children.get(category.id)!,
    })),
  }
}

/** Sidebar order as one flat list: uncategorized channels, then each category followed by its channels. */
export function flattenTree(tree: ChannelTree): Channel[] {
  return [
    ...tree.uncategorized,
    ...tree.categories.flatMap((g) => [g.category, ...g.channels]),
  ]
}

export function firstTextChannel(tree: ChannelTree): Channel | undefined {
  return flattenTree(tree).find((c) => c.type === "text")
}

/**
 * Turns a flat sidebar order back into positions and parents. Each channel belongs to the
 * nearest category above it (or none). Returns only the rows that changed.
 */
export function placementsFromOrder(order: Channel[]): ChannelPlacement[] {
  const changed: ChannelPlacement[] = []
  let currentCategory: string | null = null

  order.forEach((channel, index) => {
    let parent: string | null = null
    if (channel.type === "category") {
      currentCategory = channel.id
    } else {
      parent = currentCategory
    }
    if (channel.position !== index || channel.parent_id !== parent) {
      changed.push({ id: channel.id, position: index, parent_id: parent })
    }
  })
  return changed
}

/** Applies placements to a channel list (for optimistic updates). */
export function applyPlacements(channels: Channel[], placements: ChannelPlacement[]): Channel[] {
  const byId = new Map(placements.map((p) => [p.id, p]))
  return channels.map((c) => {
    const p = byId.get(c.id)
    return p ? { ...c, position: p.position, parent_id: p.parent_id } : c
  })
}

/** Moves a category together with its channels to sit before `beforeCategoryId` (null = the end). */
export function moveCategory(
  tree: ChannelTree,
  categoryId: string,
  targetIndex: number
): Channel[] {
  const groups = [...tree.categories]
  const from = groups.findIndex((g) => g.category.id === categoryId)
  if (from === -1) return flattenTree(tree)
  const [moved] = groups.splice(from, 1)
  groups.splice(Math.max(0, Math.min(targetIndex, groups.length)), 0, moved)
  return flattenTree({ uncategorized: tree.uncategorized, categories: groups })
}
