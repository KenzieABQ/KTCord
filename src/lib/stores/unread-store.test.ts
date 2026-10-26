import { beforeEach, describe, expect, it } from "vitest"

import { isChannelUnread, useUnreadStore } from "./unread-store"

const store = () => useUnreadStore.getState()

describe("unread store", () => {
  beforeEach(() => useUnreadStore.setState({ channels: {}, active: null, markedUnread: {} }))

  it("hydrates from the server and rolls mentions into unread channels", () => {
    store().hydrate([
      { channel_id: "a", server_id: "s", last_message_at: "2026-10-20T10:05:00Z", last_read_at: "2026-10-20T10:00:00Z", mention_count: 2 },
      { channel_id: "b", server_id: "s", last_message_at: "2026-10-20T09:00:00Z", last_read_at: "2026-10-20T10:00:00Z", mention_count: 0 },
    ])
    expect(isChannelUnread(store().channels.a)).toBe(true)
    expect(store().channels.a.mentions).toBe(2)
    expect(isChannelUnread(store().channels.b)).toBe(false)
  })

  it("keeps a newer local read marker when the server lags", () => {
    store().markRead("a", "2026-10-20T10:06:00Z")
    store().hydrate([
      { channel_id: "a", server_id: "s", last_message_at: "2026-10-20T10:05:00Z", last_read_at: "2026-10-20T10:00:00Z", mention_count: 1 },
    ])
    expect(isChannelUnread(store().channels.a)).toBe(false)
    expect(store().channels.a.mentions).toBe(0)
  })

  it("counts incoming mentions, but not your own messages", () => {
    store().onMessage({ channelId: "a", serverId: "s", createdAt: "2026-10-20T11:00:00Z", mine: false, mentionsMe: true })
    expect(store().channels.a.mentions).toBe(1)
    expect(isChannelUnread(store().channels.a)).toBe(true)

    store().onMessage({ channelId: "a", serverId: "s", createdAt: "2026-10-20T11:01:00Z", mine: true, mentionsMe: false })
    expect(isChannelUnread(store().channels.a)).toBe(false)
    expect(store().channels.a.mentions).toBe(0)
  })

  it("never moves the read marker backwards", () => {
    store().markRead("a", "2026-10-20T12:00:00Z")
    store().markRead("a", "2026-10-20T11:00:00Z")
    expect(store().channels.a.lastReadAt).toBe("2026-10-20T12:00:00Z")
  })

  describe("mark unread", () => {
    it("moves the marker back and keeps the channel unread while you stay in it", () => {
      store().onMessage({ channelId: "a", serverId: "s", createdAt: "2026-10-20T11:00:00Z", mine: true, mentionsMe: false })
      store().setActive({ channelId: "a", atBottom: true })
      store().markUnread("a", "2026-10-20T10:59:59Z", true)
      expect(isChannelUnread(store().channels.a)).toBe(true)
      expect(store().markedUnread.a).toBe("2026-10-20T10:59:59Z")
      // New messages while you're watching don't count as read either.
      store().onMessage({ channelId: "a", serverId: "s", createdAt: "2026-10-20T11:05:00Z", mine: false, mentionsMe: false })
      expect(store().channels.a.lastReadAt).toBe("2026-10-20T10:59:59Z")
    })

    it("ends when you leave the channel, send a message or mark it read", () => {
      store().setActive({ channelId: "a", atBottom: true })
      store().markUnread("a", "2026-10-20T10:00:00Z", true)
      store().setActive({ channelId: "b", atBottom: true })
      expect(store().markedUnread.a).toBeUndefined()

      store().markUnread("b", "2026-10-20T10:00:00Z", true)
      store().onMessage({ channelId: "b", serverId: "s", createdAt: "2026-10-20T11:00:00Z", mine: true, mentionsMe: false })
      expect(store().markedUnread.b).toBeUndefined()

      store().markUnread("b", "2026-10-20T10:00:00Z", true)
      store().markRead("b", "2026-10-20T11:00:00Z")
      expect(store().markedUnread.b).toBeUndefined()
    })

    it("from another device moves the marker without holding the channel unread", () => {
      store().markRead("a", "2026-10-20T11:00:00Z")
      store().markUnread("a", "2026-10-20T10:00:00Z", false)
      expect(store().channels.a.lastReadAt).toBe("2026-10-20T10:00:00Z")
      expect(store().markedUnread.a).toBeUndefined()
    })
  })
})
