import type { Json, Tables } from "@/lib/supabase/database.types"

export type MessageRow = Omit<
  Tables<"messages">,
  "search" | "has_link" | "has_image" | "has_video" | "has_file"
>

export type ReactionRow = { id: string; user_id: string; emoji: string }

/** The thread started from a message, shown as a chip under it. */
export type ThreadSummary = {
  id: string
  name: string
  message_count: number
  last_message_at: string | null
}

/** A message as the feed holds it. `status` is set only on local (optimistic) copies. */
export type ChatMessage = MessageRow & {
  status?: "sending" | "failed"
  reactions?: ReactionRow[]
  thread?: ThreadSummary | null
}

export type MessagePage = { messages: ChatMessage[]; hasMore: boolean }

export type Cursor = { createdAt: string; id: string }

/** Columns the client reads (skips the tsvector). */
export const MESSAGE_COLUMNS =
  "id, channel_id, author_id, content, type, reply_to_id, attachments, mentions, mention_roles, mention_everyone, pinned_at, pinned_by, edited_at, created_at"

export function newLocalMessage(input: {
  id: string
  channelId: string
  authorId: string
  content: string
  replyToId: string | null
  attachments?: Json
}): ChatMessage {
  return {
    id: input.id,
    channel_id: input.channelId,
    author_id: input.authorId,
    content: input.content,
    type: input.replyToId ? "reply" : "default",
    reply_to_id: input.replyToId,
    attachments: input.attachments ?? [],
    mentions: [],
    mention_roles: [],
    mention_everyone: false,
    pinned_at: null,
    pinned_by: null,
    edited_at: null,
    created_at: new Date().toISOString(),
    status: "sending",
  }
}

/** Drops server-only columns (the search vector) from a full messages row. */
export function toChatMessage(row: Tables<"messages">): ChatMessage {
  const message: Partial<Tables<"messages">> = { ...row }
  delete message.search
  delete message.has_link
  delete message.has_image
  delete message.has_video
  delete message.has_file
  return message as ChatMessage
}
