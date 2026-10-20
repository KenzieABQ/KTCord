import { getSupabase } from "@/lib/supabase/client"
import type { Json } from "@/lib/supabase/database.types"
import {
  MESSAGE_COLUMNS,
  toChatMessage,
  type ChatMessage,
  type Cursor,
  type MessagePage,
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
  return { messages: rows.slice(0, PAGE_SIZE).reverse(), hasMore }
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
}): Promise<ChatMessage> {
  const { data, error } = await getSupabase().rpc("send_message", {
    p_id: input.id,
    p_channel: input.channelId,
    p_content: input.content,
    p_reply_to: input.replyToId ?? undefined,
    p_attachments: input.attachments ?? [],
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
