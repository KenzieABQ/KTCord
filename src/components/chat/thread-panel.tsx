"use client"

import { MessagesSquareIcon, XIcon } from "lucide-react"
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

/** A thread's own feed and composer, shown beside the channel. */
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
      <header className="flex h-12 shrink-0 items-center gap-2 px-4 shadow-[0_1px_0_rgb(0_0_0/0.2)]">
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
          <MessageFeed ref={feed} channel={thread} welcome={<ThreadStart sourceId={thread.source_message_id} />} />
          <Composer onSent={() => feed.current?.scrollToBottom()} />
        </ChatProvider>
      )}
    </div>
  )
}
