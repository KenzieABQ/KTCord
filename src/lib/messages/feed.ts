import { format, isSameDay, isToday, isYesterday } from "date-fns"

import type { ChatMessage, MessagePage } from "./types"

/** Consecutive messages from one author within this window collapse into one group. */
export const GROUP_WINDOW_MS = 7 * 60 * 1000

export function compareMessages(a: Pick<ChatMessage, "created_at" | "id">, b: Pick<ChatMessage, "created_at" | "id">) {
  return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
}

export function startsNewDay(prev: ChatMessage | undefined, msg: ChatMessage): boolean {
  return !prev || !isSameDay(new Date(prev.created_at), new Date(msg.created_at))
}

/** True when `msg` renders compactly under `prev` (no avatar or name). */
export function isGroupedWith(prev: ChatMessage | undefined, msg: ChatMessage): boolean {
  if (!prev || !msg.author_id || prev.author_id !== msg.author_id) return false
  if (msg.type !== "default") return false
  if (prev.type !== "default" && prev.type !== "reply") return false
  if (Boolean(prev.status === "failed") !== Boolean(msg.status === "failed")) return false
  if (startsNewDay(prev, msg)) return false
  return new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_WINDOW_MS
}

/** "Today at 3:42 PM", "Yesterday at 9:05 AM", or "10/18/2026 3:42 PM". */
export function formatMessageTime(iso: string): string {
  const date = new Date(iso)
  if (isToday(date)) return `Today at ${format(date, "h:mm a")}`
  if (isYesterday(date)) return `Yesterday at ${format(date, "h:mm a")}`
  return format(date, "MM/dd/yyyy h:mm a")
}

export function formatDayDivider(iso: string): string {
  return format(new Date(iso), "MMMM d, yyyy")
}

/** Index of the first message after the read marker that someone else wrote, or -1. */
export function firstUnreadIndex(
  messages: ChatMessage[],
  lastReadAt: string | null,
  myId: string
): number {
  if (!lastReadAt) return -1
  return messages.findIndex((m) => m.created_at > lastReadAt && m.author_id !== myId)
}

/** Pages hold newest-first chunks; each chunk is oldest→newest. Returns one oldest→newest list. */
export function flattenPages(pages: MessagePage[]): ChatMessage[] {
  const out: ChatMessage[] = []
  for (let p = pages.length - 1; p >= 0; p--) out.push(...pages[p].messages)
  return out
}

/** Inserts or replaces a message in the page list, keeping order. New messages land in page 0. */
export function upsertIntoPages(pages: MessagePage[], message: ChatMessage): MessagePage[] {
  let found = false
  const next = pages.map((page) => {
    const index = page.messages.findIndex((m) => m.id === message.id)
    if (index === -1) return page
    found = true
    const messages = [...page.messages]
    // Keep a local status only if the incoming copy is also local.
    messages[index] = { ...messages[index], ...message, status: message.status }
    return { ...page, messages: messages.sort(compareMessages) }
  })
  if (found) return next
  if (next.length === 0) return [{ messages: [message], hasMore: false }]
  const [newest, ...older] = next
  return [{ ...newest, messages: [...newest.messages, message].sort(compareMessages) }, ...older]
}

export function removeFromPages(pages: MessagePage[], id: string): MessagePage[] {
  return pages.map((page) =>
    page.messages.some((m) => m.id === id)
      ? { ...page, messages: page.messages.filter((m) => m.id !== id) }
      : page
  )
}

export function patchInPages(
  pages: MessagePage[],
  id: string,
  patch: (m: ChatMessage) => ChatMessage
): MessagePage[] {
  return pages.map((page) =>
    page.messages.some((m) => m.id === id)
      ? { ...page, messages: page.messages.map((m) => (m.id === id ? patch(m) : m)) }
      : page
  )
}
