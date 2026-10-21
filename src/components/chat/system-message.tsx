"use client"

import { formatDistanceToNowStrict } from "date-fns"
import { ChevronRightIcon, MessagesSquareIcon, PinIcon } from "lucide-react"

import type { ChatMessage, ThreadSummary } from "@/lib/messages/types"

import { useChat } from "./chat-context"

/** "Ava pinned a message…" / "Ava started a thread: …" rows in the feed. */
export function SystemMessage({
  message,
  authorName,
  authorColor,
}: {
  message: ChatMessage
  authorName: string
  authorColor?: string
}) {
  const { jumpToMessage } = useChat()
  const name = (
    <span className="font-medium text-header" style={authorColor ? { color: authorColor } : undefined}>
      {authorName}
    </span>
  )

  return (
    <div className="group relative mt-[17px] flex items-center gap-4 py-0.5 pr-12 pl-[72px] text-[15px] text-muted-foreground hover:bg-message-hover">
      {message.type === "pin" ? (
        <>
          <PinIcon className="absolute left-7 size-4 text-interactive" />
          <p>
            {name} pinned{" "}
            <button
              type="button"
              className="font-medium text-header hover:underline"
              onClick={() => message.reply_to_id && jumpToMessage(message.reply_to_id)}
            >
              a message
            </button>{" "}
            to this channel. See all{" "}
            <button
              type="button"
              className="font-medium text-header hover:underline"
              onClick={() => document.getElementById("pins-button")?.click()}
            >
              pinned messages
            </button>
            .
          </p>
        </>
      ) : (
        <>
          <MessagesSquareIcon className="absolute left-7 size-4 text-interactive" />
          <p>
            {name} started a thread:{" "}
            <button
              type="button"
              className="font-semibold text-header hover:underline"
              onClick={() => message.reply_to_id && jumpToMessage(message.reply_to_id)}
            >
              {message.content || "Thread"}
            </button>
            . See all{" "}
            <button
              type="button"
              className="font-medium text-header hover:underline"
              onClick={() => document.getElementById("threads-button")?.click()}
            >
              threads
            </button>
            .
          </p>
        </>
      )}
      <span className="shrink-0 text-xs">{formatDistanceToNowStrict(new Date(message.created_at), { addSuffix: true })}</span>
    </div>
  )
}

/** The box under a message that started a thread: name, reply count, last activity. */
export function ThreadChip({ thread, onOpen }: { thread: ThreadSummary; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-1 flex max-w-[480px] items-center gap-2 rounded-lg border border-border bg-sidebar px-3 py-2 text-left text-sm hover:bg-item-hover"
    >
      <MessagesSquareIcon className="size-4 shrink-0 text-interactive" />
      <span className="truncate font-semibold text-header">{thread.name}</span>
      <span className="shrink-0 font-semibold text-link">
        {thread.message_count} {thread.message_count === 1 ? "Message" : "Messages"}
      </span>
      {thread.last_message_at && (
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {formatDistanceToNowStrict(new Date(thread.last_message_at), { addSuffix: true })}
        </span>
      )}
      <ChevronRightIcon className="ml-auto size-4 shrink-0 text-interactive" />
    </button>
  )
}
