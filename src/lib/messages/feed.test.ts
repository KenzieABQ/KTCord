import { describe, expect, it } from "vitest"

import {
  firstUnreadIndex,
  flattenPages,
  isGroupedWith,
  removeFromPages,
  startsNewDay,
  upsertIntoPages,
} from "./feed"
import type { ChatMessage, MessagePage } from "./types"

function msg(id: string, author: string, at: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    channel_id: "c",
    author_id: author,
    content: id,
    type: "default",
    reply_to_id: null,
    attachments: [],
    mentions: [],
    mention_roles: [],
    mention_everyone: false,
    pinned_at: null,
    pinned_by: null,
    edited_at: null,
    created_at: at,
    ...extra,
  }
}

describe("grouping", () => {
  const a1 = msg("a1", "alice", "2026-10-20T10:00:00Z")
  it("groups the same author within 7 minutes", () => {
    expect(isGroupedWith(a1, msg("a2", "alice", "2026-10-20T10:06:59Z"))).toBe(true)
  })
  it("breaks after 7 minutes, on another author, or on a reply", () => {
    expect(isGroupedWith(a1, msg("a2", "alice", "2026-10-20T10:07:01Z"))).toBe(false)
    expect(isGroupedWith(a1, msg("b1", "bob", "2026-10-20T10:01:00Z"))).toBe(false)
    expect(
      isGroupedWith(a1, msg("a2", "alice", "2026-10-20T10:01:00Z", { type: "reply", reply_to_id: "x" }))
    ).toBe(false)
  })
  it("breaks across days", () => {
    const late = msg("a", "alice", "2026-10-20T23:59:00")
    const early = msg("b", "alice", "2026-10-21T00:01:00")
    expect(startsNewDay(late, early)).toBe(true)
    expect(isGroupedWith(late, early)).toBe(false)
  })
})

describe("unread marker", () => {
  const list = [
    msg("1", "bob", "2026-10-20T10:00:00Z"),
    msg("2", "me", "2026-10-20T10:01:00Z"),
    msg("3", "bob", "2026-10-20T10:02:00Z"),
  ]
  it("finds the first message from someone else after the marker", () => {
    expect(firstUnreadIndex(list, "2026-10-20T10:00:30Z", "me")).toBe(2)
    expect(firstUnreadIndex(list, "2026-10-20T10:05:00Z", "me")).toBe(-1)
  })
})

describe("pages", () => {
  const pages: MessagePage[] = [
    { messages: [msg("3", "a", "2026-10-20T10:03:00Z"), msg("4", "a", "2026-10-20T10:04:00Z")], hasMore: true },
    { messages: [msg("1", "a", "2026-10-20T10:01:00Z"), msg("2", "a", "2026-10-20T10:02:00Z")], hasMore: false },
  ]

  it("flattens oldest to newest", () => {
    expect(flattenPages(pages).map((m) => m.id)).toEqual(["1", "2", "3", "4"])
  })

  it("appends new messages and replaces the optimistic copy in place", () => {
    const local = msg("5", "a", "2026-10-20T10:05:00Z", { status: "sending" })
    const withLocal = upsertIntoPages(pages, local)
    expect(flattenPages(withLocal).at(-1)?.status).toBe("sending")

    const confirmed = upsertIntoPages(withLocal, msg("5", "a", "2026-10-20T10:05:01Z"))
    const flat = flattenPages(confirmed)
    expect(flat.map((m) => m.id)).toEqual(["1", "2", "3", "4", "5"])
    expect(flat.at(-1)?.status).toBeUndefined()
    expect(flat.at(-1)?.created_at).toBe("2026-10-20T10:05:01Z")
  })

  it("removes by id from any page", () => {
    expect(flattenPages(removeFromPages(pages, "2")).map((m) => m.id)).toEqual(["1", "3", "4"])
  })
})
