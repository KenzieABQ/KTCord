import { getSupabase } from "@/lib/supabase/client"
import type { Json, Tables } from "@/lib/supabase/database.types"
import {
  MESSAGE_COLUMNS,
  toChatMessage,
  type ChatMessage,
  type Cursor,
  type MessagePage,
  type PollDraft,
  type ReactionRow,
  type ThreadSummary,
} from "@/lib/messages/types"

import { ApiError, toApiError, unwrap } from "./errors"

export const PAGE_SIZE = 50

/** One page of history, newest first from the database, returned oldest→newest. */
export async function fetchMessages(channelId: string, before: Cursor | null): Promise<MessagePage> {
  let query = getSupabase()
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1)
  if (before) {
    query = query.or(
      `created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id})`
    )
  }
  const rows = unwrap(await query.returns<ChatMessage[]>())
  const hasMore = rows.length > PAGE_SIZE
  const messages = await withExtras(rows.slice(0, PAGE_SIZE).reverse())
  return { messages, hasMore }
}

/** Adds each message's reactions and thread summary (two batched queries). */
export async function withExtras(messages: ChatMessage[]): Promise<ChatMessage[]> {
  if (messages.length === 0) return messages
  const ids = messages.map((m) => m.id)
  const supabase = getSupabase()
  const [reactions, threads] = await Promise.all([
    supabase.from("reactions").select("id, message_id, user_id, emoji").in("message_id", ids).order("created_at"),
    supabase
      .from("channels")
      .select("id, name, source_message_id, activity:channel_activity(message_count, last_message_at)")
      .in("source_message_id", ids),
  ])
  const byMessage = new Map<string, ReactionRow[]>()
  for (const r of reactions.data ?? []) {
    const list = byMessage.get(r.message_id) ?? []
    list.push({ id: r.id, user_id: r.user_id, emoji: r.emoji })
    byMessage.set(r.message_id, list)
  }
  const threadByMessage = new Map<string, ThreadSummary>()
  for (const t of (threads.data ?? []) as {
    id: string
    name: string | null
    source_message_id: string | null
    activity: { message_count: number; last_message_at: string } | { message_count: number; last_message_at: string }[] | null
  }[]) {
    const a = Array.isArray(t.activity) ? t.activity[0] : t.activity
    if (t.source_message_id) {
      threadByMessage.set(t.source_message_id, {
        id: t.id,
        name: t.name ?? "Thread",
        message_count: Number(a?.message_count ?? 0),
        last_message_at: a?.last_message_at ?? null,
      })
    }
  }
  return messages.map((m) => ({
    ...m,
    reactions: byMessage.get(m.id) ?? [],
    thread: threadByMessage.get(m.id) ?? null,
  }))
}

export async function fetchMessagesById(ids: string[]): Promise<ChatMessage[]> {
  if (ids.length === 0) return []
  return unwrap(
    await getSupabase().from("messages").select(MESSAGE_COLUMNS).in("id", ids).returns<ChatMessage[]>()
  )
}

export async function sendMessage(input: {
  id: string
  channelId: string
  content: string
  replyToId: string | null
  attachments?: Json
  replyPing?: boolean
  /** Forward this message (the database copies its text into a snapshot). */
  forwardId?: string | null
  poll?: PollDraft | null
}): Promise<ChatMessage> {
  const { data, error } = await getSupabase().rpc("send_message", {
    p_id: input.id,
    p_channel: input.channelId,
    p_content: input.content,
    p_reply_to: input.replyToId ?? undefined,
    p_attachments: input.attachments ?? [],
    p_reply_ping: input.replyPing ?? true,
    p_forward: input.forwardId ?? undefined,
    p_poll: (input.poll ?? undefined) as Json | undefined,
  })
  if (error) throw toApiError(error)
  const row = data?.[0]
  if (!row) throw new ApiError("Your message couldn't be delivered.")
  return toChatMessage(row)
}

export async function editMessage(id: string, content: string): Promise<ChatMessage> {
  return unwrap(
    await getSupabase()
      .from("messages")
      .update({ content })
      .eq("id", id)
      .select(MESSAGE_COLUMNS)
      .returns<ChatMessage[]>()
      .single()
  )
}

export async function deleteMessage(id: string): Promise<void> {
  const { error, count } = await getSupabase().from("messages").delete({ count: "exact" }).eq("id", id)
  if (error) throw toApiError(error)
  if (count === 0) throw new ApiError("You can't delete that message.")
}

/** Moves your read marker back to just before this message; returns the new marker. */
export async function markUnread(channelId: string, messageId: string): Promise<string> {
  const { data, error } = await getSupabase().rpc("mark_unread", { p_channel: channelId, p_message: messageId })
  if (error) throw toApiError(error)
  return data
}

export async function markRead(channelId: string, messageId: string): Promise<void> {
  const { error } = await getSupabase().rpc("mark_read", { p_channel: channelId, p_message: messageId })
  if (error) throw toApiError(error)
}

export type UnreadRow = {
  channel_id: string
  server_id: string | null
  last_message_at: string
  last_read_at: string
  mention_count: number
}

export async function getUnreadState(): Promise<UnreadRow[]> {
  const { data, error } = await getSupabase().rpc("get_unread_state")
  if (error) throw toApiError(error)
  return data ?? []
}

// ---------------------------------------------------------------------------
// Reactions, pins, threads, search
// ---------------------------------------------------------------------------

export async function addReaction(message: { id: string; channel_id: string }, emoji: string): Promise<ReactionRow> {
  // channel_id is also set (and checked) by a trigger from the message.
  const { data, error } = await getSupabase()
    .from("reactions")
    .insert({ message_id: message.id, channel_id: message.channel_id, emoji })
    .select("id, user_id, emoji")
    .single()
  if (error?.code === "42501") throw new ApiError("You don't have permission to add new reactions here.", error.code)
  if (error) throw toApiError(error)
  return data
}

export async function removeReaction(messageId: string, userId: string, emoji: string) {
  const { error } = await getSupabase()
    .from("reactions")
    .delete()
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji)
  if (error) throw toApiError(error)
}

export async function pinMessage(messageId: string, pinned: boolean) {
  const { error } = await getSupabase().rpc("pin_message", { p_message: messageId, p_pinned: pinned })
  if (error) throw toApiError(error)
}

export async function listPins(channelId: string): Promise<ChatMessage[]> {
  return unwrap(
    await getSupabase()
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("channel_id", channelId)
      .not("pinned_at", "is", null)
      .order("pinned_at", { ascending: false })
      .returns<ChatMessage[]>()
  )
}

export async function createThread(messageId: string, name: string): Promise<string> {
  const { data, error } = await getSupabase().rpc("create_thread", { p_message: messageId, p_name: name })
  if (error) throw toApiError(error)
  return data
}

export type ThreadListItem = ThreadSummary & { owner_id: string | null; created_at: string; source_message_id: string | null }

export async function listThreads(parentChannelId: string): Promise<ThreadListItem[]> {
  const rows = unwrap(
    await getSupabase()
      .from("channels")
      .select("id, name, owner_id, created_at, source_message_id, activity:channel_activity(message_count, last_message_at)")
      .eq("parent_id", parentChannelId)
      .eq("type", "thread")
  ) as {
    id: string
    name: string | null
    owner_id: string | null
    created_at: string
    source_message_id: string | null
    activity: { message_count: number; last_message_at: string } | { message_count: number; last_message_at: string }[] | null
  }[]
  return rows
    .map((t) => {
      const a = Array.isArray(t.activity) ? t.activity[0] : t.activity
      return {
        id: t.id,
        name: t.name ?? "Thread",
        owner_id: t.owner_id,
        created_at: t.created_at,
        source_message_id: t.source_message_id,
        message_count: Number(a?.message_count ?? 0),
        last_message_at: a?.last_message_at ?? null,
      }
    })
    .sort((a, b) => (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at))
}

export async function getChannelById(channelId: string): Promise<Tables<"channels">> {
  return unwrap(
    await getSupabase().from("channels").select("*").eq("id", channelId).returns<Tables<"channels">[]>().single()
  )
}

export type SearchParams = {
  serverId?: string
  channelId?: string
  query?: string
  authorId?: string
  mentionsId?: string
  has?: ("image" | "video" | "file" | "link")[]
  offset?: number
}

export type SearchResult = { total: number; messages: ChatMessage[] }

export async function searchMessages(params: SearchParams): Promise<SearchResult> {
  const { data, error } = await getSupabase().rpc("search_messages", {
    p_server: params.serverId,
    p_channel: params.channelId,
    p_query: params.query || undefined,
    p_author: params.authorId,
    p_mentions: params.mentionsId,
    p_has: params.has?.length ? params.has : undefined,
    p_limit: 25,
    p_offset: params.offset ?? 0,
  })
  if (error) throw toApiError(error)
  const result = data as unknown as { total: number; messages: (ChatMessage & Record<string, unknown>)[] }
  return {
    total: Number(result.total),
    messages: result.messages.map((m) => toChatMessage(m as never)),
  }
}
