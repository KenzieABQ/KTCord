"use client"

import { PaperclipIcon } from "@/components/icons"

import { UserAvatar } from "@/components/profile/user-avatar"
import { formatMessageTime } from "@/lib/messages/feed"
import type { ChatMessage } from "@/lib/messages/types"

import { Markdown } from "./markdown"
import { useAuthor } from "./use-author"

/** A compact, read-only message card for the pins and search panels. */
export function MessagePreview({ message, actions }: { message: ChatMessage; actions?: React.ReactNode }) {
  const author = useAuthor(message.author_id)
  const attachments = Array.isArray(message.attachments) ? message.attachments.length : 0
  return (
    <div className="group relative flex gap-3 rounded-md border border-border bg-chat p-3">
      <UserAvatar userId={message.author_id ?? "x"} name={author.name} src={author.avatarUrl} className="size-9" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-medium text-header" style={author.color ? { color: author.color } : undefined}>
            {author.name}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatMessageTime(message.created_at)}</span>
        </div>
        {message.content && <Markdown content={message.content} className="line-clamp-6 text-sm" />}
        {attachments > 0 && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <PaperclipIcon className="size-3" /> {attachments} {attachments === 1 ? "attachment" : "attachments"}
          </p>
        )}
      </div>
      {/* Invisible rather than hidden, so keyboard users can still tab to the actions. */}
      {actions && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          {actions}
        </div>
      )}
    </div>
  )
}
