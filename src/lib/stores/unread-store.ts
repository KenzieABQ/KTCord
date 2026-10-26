import { create } from "zustand"

import type { UnreadRow } from "@/lib/api/messages"

export type ChannelUnread = {
  serverId: string | null
  lastMessageAt: string | null
  lastReadAt: string | null
  mentions: number
}

type ActiveView = { channelId: string; atBottom: boolean } | null

type UnreadState = {
  channels: Record<string, ChannelUnread>
  /** The channel on screen and whether the feed is scrolled to the newest message. */
  active: ActiveView
  /**
   * Channels you marked unread here, with the new marker. While you stay in one, reading it
   * doesn't mark it read again (as in Discord); leaving it or sending a message does.
   */
  markedUnread: Record<string, string>

  hydrate: (rows: UnreadRow[]) => void
  setActive: (active: ActiveView) => void
  /** A new message arrived (from anyone). */
  onMessage: (input: {
    channelId: string
    serverId: string | null
    createdAt: string
    mine: boolean
    mentionsMe: boolean
  }) => void
  markRead: (channelId: string, at: string) => void
  /** Moves the read marker back (Mark Unread); `here` when this tab did it. */
  markUnread: (channelId: string, at: string, here: boolean) => void
}

const empty = (serverId: string | null): ChannelUnread => ({
  serverId,
  lastMessageAt: null,
  lastReadAt: null,
  mentions: 0,
})

function isWatching(active: ActiveView, channelId: string, markedUnread: Record<string, string>) {
  return (
    active?.channelId === channelId &&
    !markedUnread[channelId] &&
    active.atBottom &&
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    document.hasFocus()
  )
}

export const useUnreadStore = create<UnreadState>()((set, get) => ({
  channels: {},
  active: null,
  markedUnread: {},

  hydrate: (rows) =>
    set((s) => {
      const channels: Record<string, ChannelUnread> = {}
      for (const row of rows) {
        const local = s.channels[row.channel_id]
        // Keep a newer local read marker (mark_read is debounced, so the server can lag).
        const lastReadAt =
          local?.lastReadAt && local.lastReadAt > row.last_read_at ? local.lastReadAt : row.last_read_at
        channels[row.channel_id] = {
          serverId: row.server_id,
          lastMessageAt: row.last_message_at,
          lastReadAt,
          mentions: lastReadAt >= row.last_message_at ? 0 : Number(row.mention_count) || 0,
        }
      }
      return { channels }
    }),

  setActive: (active) =>
    set((s) => {
      // Leaving a channel you marked unread lets it be read normally next time.
      const left = s.active?.channelId
      if (!left || left === active?.channelId || !s.markedUnread[left]) return { active }
      return { active, markedUnread: without(s.markedUnread, left) }
    }),

  onMessage: ({ channelId, serverId, createdAt, mine, mentionsMe }) => {
    const prev = get().channels[channelId] ?? empty(serverId)
    // Your own messages, and messages that land while you're watching the bottom of the
    // channel, count as read straight away.
    const seen = mine || isWatching(get().active, channelId, get().markedUnread)
    set((s) => ({
      markedUnread: mine ? without(s.markedUnread, channelId) : s.markedUnread,
      channels: {
        ...s.channels,
        [channelId]: {
          serverId: prev.serverId ?? serverId,
          lastMessageAt:
            !prev.lastMessageAt || createdAt > prev.lastMessageAt ? createdAt : prev.lastMessageAt,
          lastReadAt: seen ? createdAt : prev.lastReadAt,
          mentions: seen ? 0 : prev.mentions + (mentionsMe ? 1 : 0),
        },
      },
    }))
  },

  markRead: (channelId, at) =>
    set((s) => {
      const prev = s.channels[channelId] ?? empty(null)
      const markedUnread = without(s.markedUnread, channelId)
      if (prev.lastReadAt && prev.lastReadAt >= at && prev.mentions === 0) {
        return markedUnread === s.markedUnread ? s : { markedUnread }
      }
      return {
        markedUnread,
        channels: {
          ...s.channels,
          [channelId]: {
            ...prev,
            lastReadAt: !prev.lastReadAt || at > prev.lastReadAt ? at : prev.lastReadAt,
            mentions: 0,
          },
        },
      }
    }),

  markUnread: (channelId, at, here) =>
    set((s) => {
      const prev = s.channels[channelId] ?? empty(null)
      return {
        channels: { ...s.channels, [channelId]: { ...prev, lastReadAt: at } },
        markedUnread: here ? { ...s.markedUnread, [channelId]: at } : s.markedUnread,
      }
    }),
}))

function without(map: Record<string, string>, key: string) {
  if (!(key in map)) return map
  const next = { ...map }
  delete next[key]
  return next
}

export function isChannelUnread(entry: ChannelUnread | undefined): boolean {
  return Boolean(
    entry?.lastMessageAt && (!entry.lastReadAt || entry.lastMessageAt > entry.lastReadAt)
  )
}

function rollup(channels: Record<string, ChannelUnread>, serverId: string) {
  let unread = false
  let mentions = 0
  for (const entry of Object.values(channels)) {
    if (entry.serverId !== serverId) continue
    if (isChannelUnread(entry)) unread = true
    mentions += entry.mentions
  }
  return { unread, mentions }
}

/** Server roll-up for the rail: any unread channel, and the total mentions. */
export function useServerUnread(serverId: string): { unread: boolean; mentions: number } {
  // Select a primitive so the rail only re-renders when this server's roll-up changes.
  const key = useUnreadStore((s) => {
    const r = rollup(s.channels, serverId)
    return `${r.unread ? 1 : 0}:${r.mentions}`
  })
  const [unread, mentions] = key.split(":")
  return { unread: unread === "1", mentions: Number(mentions) }
}

export function useChannelUnread(channelId: string): { unread: boolean; mentions: number } {
  const entry = useUnreadStore((s) => s.channels[channelId])
  return { unread: isChannelUnread(entry), mentions: entry?.mentions ?? 0 }
}
