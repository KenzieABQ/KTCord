"use client"

import { MessagesSquareIcon, XIcon } from "@/components/icons"
import { useCallback, useRef } from "react"

import { MessageFeedSkeleton } from "@/components/layout/skeletons"
import { useReferencedMessage, useThreadChannel } from "@/lib/queries/messages"

import { ChatProvider } from "./chat-context"
import { Composer } from "./composer"
import { MessageFeed, type MessageFeedHandle } from "./message-feed"
import { MessagePreview } from "./message-preview"

function ThreadStart({ sourceId }: { sourceId: string | null }) {
  const { data: source } = useReferencedMessage(sourceId)
  return (
    <div className="px-4 pt-6 pb-3">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-secondary">
        <MessagesSquareIcon className="size-6 text-white" />
      </div>
      <p className="mb-2 text-sm text-muted-foreground">Started from:</p>
      {source ? (
        <MessagePreview message={source} />
      ) : (
        <p className="text-sm text-muted-foreground italic">The original message was deleted.</p>
      )}
    </div>
  )
}

/** The top of a forum post: its title (the first message follows as the feed's first item). */
function PostStart({ name }: { name: string }) {
  return (
    <div className="px-4 pt-6 pb-2">
      <h3 className="text-2xl font-bold break-words text-header">{name}</h3>
    </div>
  )
}

/** A thread's (or forum post's) own feed and composer, shown beside the channel. */
export function ThreadPanel({
  serverId,
  threadId,
  onClose,
}: {
  serverId: string
  threadId: string
  onClose: () => void
}) {
  const { data: thread, isError } = useThreadChannel(threadId)
  const feed = useRef<MessageFeedHandle>(null)
  const jumpToMessage = useCallback((id: string) => feed.current?.jumpToMessage(id), [])

  return (
    <div className="flex h-full min-w-0 flex-col bg-chat">
      <header className="flex h-12 shrink-0 items-center gap-2 px-4 border-b border-border">
        <MessagesSquareIcon className="size-5 shrink-0 text-muted-foreground" />
        <h2 className="min-w-0 flex-1 truncate font-semibold text-header">{thread?.name ?? "Thread"}</h2>
        <button
          type="button"
          aria-label="Close thread"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-md text-interactive hover:text-interactive-hover"
        >
          <XIcon className="size-5" />
        </button>
      </header>
      {isError ? (
        <p className="p-6 text-center text-muted-foreground">This thread is gone or you can&apos;t see it.</p>
      ) : !thread ? (
        <div className="flex flex-1 flex-col justify-end">
          <MessageFeedSkeleton rows={3} />
        </div>
      ) : (
        <ChatProvider key={thread.id} serverId={serverId} channel={thread} jumpToMessage={jumpToMessage}>
          <MessageFeed
            ref={feed}
            channel={thread}
            welcome={thread.source_message_id ? <ThreadStart sourceId={thread.source_message_id} /> : <PostStart name={thread.name ?? "Post"} />}
          />
          <Composer onSent={() => feed.current?.scrollToBottom()} />
        </ChatProvider>
      )}
    </div>
  )
}
