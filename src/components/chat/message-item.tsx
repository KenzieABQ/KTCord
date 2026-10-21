"use client"

import { format } from "date-fns"
import { RotateCwIcon } from "lucide-react"
import { memo, useMemo, useState } from "react"
import { toast } from "sonner"

import { UserAvatar } from "@/components/profile/user-avatar"
import { UserPopover } from "@/components/profile/user-popover"
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useShiftHeld } from "@/hooks/use-shift-held"
import { errorMessage } from "@/lib/api/errors"
import { parseMarkdown, toPlainText } from "@/lib/markdown/parse"
import { memberDisplayName } from "@/lib/members"
import { decodeMentions, encodeMentions } from "@/lib/mentions"
import { formatDayDivider, formatMessageTime } from "@/lib/messages/feed"
import type { ChatMessage } from "@/lib/messages/types"
import type { Attachment } from "@/lib/api/attachments"
import {
  useEditMessage,
  usePinMessage,
  useReferencedMessage,
  useSendMessage,
  useToggleReaction,
} from "@/lib/queries/messages"
import { useUserId } from "@/lib/stores/auth-store"
import { useComposerStore } from "@/lib/stores/composer-store"
import { useUiStore } from "@/lib/stores/ui-store"
import { cn } from "@/lib/utils"

import { useChat } from "./chat-context"
import { focusComposer } from "./composer"
import { Markdown } from "./markdown"
import { MessageContextMenuContent, MessageToolbar, type MessageActionHandlers } from "./message-actions"
import { MessageAttachments } from "./message-attachments"
import { MessageEditor } from "./message-editor"
import { ReactionBar } from "./reaction-bar"
import { SystemMessage, ThreadChip } from "./system-message"
import { useAuthor } from "./use-author"

export function DayDivider({ iso }: { iso: string }) {
  return (
    <div role="separator" className="mx-4 mt-6 mb-2 flex items-center gap-2">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs font-semibold text-muted-foreground">{formatDayDivider(iso)}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

export function NewMessagesDivider() {
  return (
    <div role="separator" aria-label="New messages" className="relative mx-4 mt-3 mb-1 flex items-center">
      <span className="h-px flex-1 bg-mention" />
      <span className="rounded-sm bg-mention px-1 text-[10px] leading-4 font-bold text-white uppercase">
        New
      </span>
    </div>
  )
}

function Timestamp({ iso, compact }: { iso: string; compact?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time dateTime={iso} className={cn("text-xs text-muted-foreground", compact && "text-[11px]")}>
          {compact ? format(new Date(iso), "h:mm a") : formatMessageTime(iso)}
        </time>
      </TooltipTrigger>
      <TooltipContent side="top">{format(new Date(iso), "EEEE, MMMM d, yyyy h:mm a")}</TooltipContent>
    </Tooltip>
  )
}

/** The quoted line above a reply: who it answers and a one-line preview. Click to jump there. */
function ReplyPreview({ messageId }: { messageId: string | null }) {
  const { membersById, rolesById, channelsById, jumpToMessage } = useChat()
  const { data: original, isPending } = useReferencedMessage(messageId)
  const author = useAuthor(original?.author_id ?? null)

  const preview = useMemo(() => {
    if (!original) return null
    const text = toPlainText(parseMarkdown(original.content), {
      user: (id) => {
        const member = membersById.get(id)
        return member ? memberDisplayName(member) : "unknown-user"
      },
      role: (id) => rolesById.get(id)?.name ?? "deleted-role",
      channel: (id) => channelsById.get(id)?.name ?? "unknown",
    })
    return text || "Click to see attachment"
  }, [original, membersById, rolesById, channelsById])

  return (
    <div className="relative mb-0.5 flex items-center gap-1 pl-[56px] text-sm">
      <span
        aria-hidden
        className="absolute top-1/2 left-[34px] h-2.5 w-[30px] rounded-tl-md border-t-2 border-l-2 border-interactive/40"
      />
      {!messageId || (!isPending && !original) ? (
        <span className="text-muted-foreground italic">Original message was deleted</span>
      ) : original ? (
        <button
          type="button"
          onClick={() => jumpToMessage(original.id)}
          className="flex min-w-0 items-center gap-1 text-left text-muted-foreground hover:text-interactive-hover"
        >
          <UserAvatar
            userId={original.author_id ?? "x"}
            name={author.name}
            src={author.avatarUrl}
            className="size-4"
          />
          <span className="shrink-0 font-medium" style={author.color ? { color: author.color } : undefined}>
            @{author.name}
          </span>
          <span className="truncate">{preview}</span>
        </button>
      ) : (
        <span className="h-4 w-40 animate-pulse rounded bg-item-selected/60" />
      )}
    </div>
  )
}

export const MessageItem = memo(function MessageItem({
  message,
  grouped,
  highlighted,
  onDeleteRequest,
}: {
  message: ChatMessage
  grouped: boolean
  highlighted: boolean
  onDeleteRequest: (message: ChatMessage, skipConfirm: boolean) => void
}) {
  const userId = useUserId()
  const {
    serverId,
    basePath,
    channel,
    membersById,
    canSend,
    canManageMessages,
    canAddReactions,
    canPin,
    canStartThreads,
    mentionSources,
  } = useChat()
  const author = useAuthor(message.author_id)
  const shiftHeld = useShiftHeld()
  const editing = useComposerStore((s) => s.editingId === message.id)
  const setEditing = useComposerStore((s) => s.setEditing)
  const setReplyTo = useComposerStore((s) => s.setReplyTo)
  const editMessage = useEditMessage(channel.id)
  const sendMessage = useSendMessage(channel.id)
  const toggleReaction = useToggleReaction(channel.id)
  const pin = usePinMessage(channel.id)
  const openDialog = useUiStore((s) => s.openDialog)
  const openSidePanel = useUiStore((s) => s.openSidePanel)
  const [menuOpen, setMenuOpen] = useState(false)

  const mine = message.author_id === userId
  const myRoles = membersById.get(userId)?.role_ids ?? []
  const mentionsMe =
    !mine &&
    (message.mentions.includes(userId) ||
      message.mention_everyone ||
      message.mention_roles.some((id) => myRoles.includes(id)))

  const sent = !message.status
  const onError = (error: unknown) => toast.error(errorMessage(error))
  const actions: MessageActionHandlers = {
    canEdit: mine && sent,
    canDelete: mine || canManageMessages,
    canReply: canSend && sent,
    canReact: canAddReactions && sent,
    canPin: canPin && sent,
    canThread: sent && (Boolean(message.thread) || canStartThreads),
    onReply: () => {
      setReplyTo(channel.id, message.id)
      focusComposer(channel.id)
    },
    onEdit: () => setEditing(message.id),
    onDelete: (skipConfirm) => onDeleteRequest(message, skipConfirm),
    onReact: (emoji) => toggleReaction.mutate({ message, emoji }, { onError }),
    onTogglePin: () => pin.mutate({ messageId: message.id, pinned: !message.pinned_at }, { onError }),
    onCreateThread: () =>
      message.thread
        ? openSidePanel({ kind: "thread", channelId: channel.id, threadId: message.thread.id })
        : openDialog({
            kind: "create-thread",
            serverId: serverId ?? "",
            channelId: channel.id,
            messageId: message.id,
            defaultName: message.content.replace(/\s+/g, " ").slice(0, 40),
          }),
  }

  if (message.type === "pin" || message.type === "thread_created") {
    return <SystemMessage message={message} authorName={author.name} authorColor={author.color} />
  }

  const attachments = (message.attachments ?? []) as unknown as Attachment[]

  function save(content: string) {
    setEditing(null)
    editMessage.mutate(
      { id: message.id, content: encodeMentions(content, mentionSources) },
      { onError: (error) => toast.error(errorMessage(error)) }
    )
  }

  const showHeader = !grouped || message.type === "reply"

  return (
    <ContextMenu onOpenChange={setMenuOpen}>
      <ContextMenuTrigger asChild>
        <article
          id={`message-${message.id}`}
          aria-labelledby={`message-${message.id}-author`}
          data-highlighted={highlighted || undefined}
          className={cn(
            "group relative py-0.5 pr-12 transition-colors hover:bg-message-hover",
            showHeader && "mt-[17px]",
            (menuOpen || editing) && "bg-message-hover",
            mentionsMe && "bg-mention-bg before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-status-idle hover:bg-[rgb(250_168_26/0.08)]",
            highlighted && "bg-primary/10"
          )}
        >
          {message.type === "reply" && <ReplyPreview messageId={message.reply_to_id} />}

          <div className="relative min-h-[1.375rem] pl-[72px]">
            {showHeader ? (
              <>
                <UserPopover userId={message.author_id} serverId={serverId}>
                  <button
                    type="button"
                    aria-label={`${author.name}'s profile`}
                    className="absolute top-0.5 left-4 rounded-full active:translate-y-px"
                  >
                    <UserAvatar
                      userId={message.author_id ?? "deleted"}
                      name={author.name}
                      src={author.avatarUrl}
                      className="size-10"
                    />
                  </button>
                </UserPopover>
                <h3 className="flex items-baseline gap-2 leading-[1.375rem]">
                  <UserPopover userId={message.author_id} serverId={serverId}>
                    <button
                      type="button"
                      id={`message-${message.id}-author`}
                      className="truncate font-medium text-header hover:underline"
                      style={author.color ? { color: author.color } : undefined}
                    >
                      {author.name}
                    </button>
                  </UserPopover>
                  <Timestamp iso={message.created_at} />
                </h3>
              </>
            ) : (
              <span className="absolute top-0.5 left-0 hidden w-[72px] pr-1 text-center group-hover:block">
                <Timestamp iso={message.created_at} compact />
              </span>
            )}

            {editing ? (
              <MessageEditor
                initial={decodeMentions(message.content, mentionSources)}
                onSave={save}
                onCancel={() => setEditing(null)}
                onEmpty={() => {
                  setEditing(null)
                  onDeleteRequest(message, false)
                }}
              />
            ) : (
              <div className={cn(message.status === "sending" && "opacity-60", message.status === "failed" && "[&_*]:text-mention")}>
                {message.content && <Markdown content={message.content} />}
                {message.edited_at && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="ml-1 text-[10px] text-muted-foreground select-none">(edited)</span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {format(new Date(message.edited_at), "EEEE, MMMM d, yyyy h:mm a")}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}

            {attachments.length > 0 && <MessageAttachments attachments={attachments} />}
            <ReactionBar message={message} />
            {message.thread && (
              <ThreadChip
                thread={message.thread}
                onOpen={() =>
                  openSidePanel({ kind: "thread", channelId: channel.id, threadId: message.thread!.id })
                }
              />
            )}

            {message.status === "failed" && (
              <p className="mt-0.5 flex items-center gap-2 text-xs text-mention">
                Message failed to send.
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-medium text-link hover:underline"
                  onClick={() => sendMessage.mutate(message)}
                >
                  <RotateCwIcon className="size-3" /> Retry
                </button>
                <button
                  type="button"
                  className="font-medium text-muted-foreground hover:underline"
                  onClick={() => onDeleteRequest(message, true)}
                >
                  Delete
                </button>
              </p>
            )}
          </div>

          {!editing && (
            <div
              className={cn(
                "absolute -top-4 right-4 z-10 hidden group-hover:flex",
                menuOpen && "flex"
              )}
            >
              <MessageToolbar
                basePath={basePath}
                message={message}
                actions={actions}
                shiftHeld={shiftHeld}
                onMenuOpenChange={setMenuOpen}
              />
            </div>
          )}
        </article>
      </ContextMenuTrigger>
      <MessageContextMenuContent basePath={basePath} message={message} actions={actions} />
    </ContextMenu>
  )
})

