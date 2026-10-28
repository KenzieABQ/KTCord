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
  "id, channel_id, author_id, content, type, reply_to_id, attachments, mentions, mention_roles, mention_everyone, pinned_at, pinned_by, edited_at, created_at, reply_ping, forwarded, poll, published_at"

/** The original message a forward carries (built by the database from the real message). */
export type ForwardSnapshot = {
  message_id: string
  channel_id: string
  author_id: string | null
  content: string
  created_at: string
  /** Set on copies of a published announcement (see publish_message). */
  published?: boolean
  channel_name?: string
  server_name?: string
}

export type PollAnswer = { id: number; text: string; emoji: string | null }
export type Poll = { question: string; answers: PollAnswer[]; multiselect: boolean; expires_at: string }

/** What the composer sends to create a poll; the database validates and normalizes it. */
export type PollDraft = {
  question: string
  answers: { text: string; emoji?: string | null }[]
  multiselect: boolean
  duration_hours: number
}

export function forwardOf(message: Pick<MessageRow, "forwarded">): ForwardSnapshot | null {
  const f = message.forwarded as Partial<ForwardSnapshot> | null
  return f && typeof f === "object" && typeof f.message_id === "string" ? (f as ForwardSnapshot) : null
}

export function pollOf(message: Pick<MessageRow, "poll">): Poll | null {
  const p = message.poll as Partial<Poll> | null
  return p && typeof p === "object" && typeof p.question === "string" && Array.isArray(p.answers) ? (p as Poll) : null
}

/** The text to preview a message by: its content, else its poll question, else what it forwards. */
export function previewText(message: Pick<MessageRow, "content" | "forwarded" | "poll">): string {
  if (message.content) return message.content
  const poll = pollOf(message)
  if (poll) return `Poll: ${poll.question}`
  return forwardOf(message)?.content ?? ""
}

export function newLocalMessage(input: {
  id: string
  channelId: string
  authorId: string
  content: string
  replyToId: string | null
  attachments?: Json
  replyPing?: boolean
  forwarded?: ForwardSnapshot | null
  poll?: Poll | null
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
    reply_ping: input.replyPing ?? true,
    forwarded: input.forwarded ?? null,
    poll: input.poll ?? null,
    published_at: null,
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
