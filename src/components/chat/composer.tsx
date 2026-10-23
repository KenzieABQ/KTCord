"use client"

import { useQueryClient, type InfiniteData } from "@tanstack/react-query"
import { format } from "date-fns"
import { ClockIcon, HourglassIcon, PlusCircleIcon, SmileIcon, XIcon } from "lucide-react"
import { useRef } from "react"
import { toast } from "sonner"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAutosize } from "@/hooks/use-autosize"
import {
  attachmentKind,
  attachmentPath,
  imageSize,
  type Attachment,
} from "@/lib/api/attachments"
import { errorMessage } from "@/lib/api/errors"
import { visibleElementById } from "@/lib/dom"
import { flattenPages } from "@/lib/messages/feed"
import { newLocalMessage, type MessagePage } from "@/lib/messages/types"
import { qk } from "@/lib/queries/keys"
import { findCachedMessage, useSendMessage } from "@/lib/queries/messages"
import { parseCustomEmoji } from "@/lib/emoji"
import { useTypingChannel } from "@/lib/realtime/use-typing-channel"
import { formatSlowmode } from "@/lib/slowmode"
import { useUserId } from "@/lib/stores/auth-store"
import { useComposerStore } from "@/lib/stores/composer-store"
import { useUploadStore, type PendingFile } from "@/lib/stores/upload-store"
import type { Json } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

import { AttachmentTray, stageFiles } from "./attachment-tray"
import { useChat } from "./chat-context"
import { EmojiPickerPopover } from "./emoji-picker"
import { MentionPopup } from "./mention-popup"
import { TypingIndicator } from "./typing-indicator"
import { useMessageCodec } from "./use-message-codec"
import { useSlowmode } from "./use-slowmode"
import { useMentionAutocomplete } from "./use-mention-autocomplete"
import { useAuthor } from "./use-author"

const MAX_LENGTH = 2000
const EMPTY: PendingFile[] = []

function ReplyBar({ messageId, onCancel }: { messageId: string; onCancel: () => void }) {
  const queryClient = useQueryClient()
  const original = findCachedMessage(queryClient, messageId)
  const author = useAuthor(original?.author_id ?? null)
  return (
    <div className="flex h-8 items-center justify-between rounded-t-lg bg-sidebar px-4 text-sm text-muted-foreground">
      <span className="truncate">
        Replying to{" "}
        <strong className="font-semibold text-header" style={author.color ? { color: author.color } : undefined}>
          {author.name}
        </strong>
      </span>
      <button
        type="button"
        aria-label="Cancel reply"
        onClick={onCancel}
        className="rounded-full text-interactive hover:text-interactive-hover"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  )
}

/**
 * The message box: Enter sends, Shift+Enter adds a line, Escape drops a reply,
 * and Up Arrow in an empty box edits your last message. Sends optimistically.
 */
/** Element id of a channel's composer textarea; a thread panel can sit beside its parent's. */
export const composerInputId = (channelId: string) => `composer-input-${channelId}`

/** Moves focus to a channel's composer, e.g. after picking Reply or dropping files. */
export function focusComposer(channelId: string) {
  visibleElementById(composerInputId(channelId))?.focus()
}

/** Opens the file picker of a channel's composer, if the user can attach files there. */
export function pickComposerFiles(channelId: string) {
  // The file input itself is always hidden, so find it through the visible message box.
  visibleElementById<HTMLTextAreaElement>(composerInputId(channelId))
    ?.form?.querySelector<HTMLInputElement>("input[type=file]")
    ?.click()
}

export function Composer({ onSent }: { onSent: () => void }) {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const { channel, channelLabel, canSend, canAttach, timedOutUntil } = useChat()
  const { encode } = useMessageCodec()
  const slowmode = useSlowmode()
  const staged = useUploadStore((s) => s.staged[channel.id] ?? EMPTY)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const draft = useComposerStore((s) => s.drafts[channel.id] ?? "")
  const replyTo = useComposerStore((s) => s.replyTo[channel.id])
  const { setDraft, setReplyTo, setEditing } = useComposerStore.getState()
  const sendMessage = useSendMessage(channel.id)
  const { notifyTyping, notifyStopped } = useTypingChannel(channel.id)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  useAutosize(inputRef, draft)
  const mentions = useMentionAutocomplete(inputRef, draft, (next) => setDraft(channel.id, next))

  async function send() {
    const content = encode(draft.trim())
    if (!content && staged.length === 0) return
    if (slowmode.remaining > 0) {
      toast(`Slow mode is on. You can send another message in ${slowmode.remaining}s.`, { id: "slowmode" })
      return
    }
    if (content.length > MAX_LENGTH) {
      toast.error(`Messages can be up to ${MAX_LENGTH} characters. Yours is ${content.length}.`)
      return
    }
    const id = crypto.randomUUID()
    // Files upload before the message is posted; the message shows local previews meanwhile.
    const files = await Promise.all(
      staged.map(async (item, index) => ({
        item,
        path: attachmentPath(channel.id, id, index, item.file.name),
        size: await imageSize(item.file),
      }))
    )
    const attachments: Attachment[] = files.map(({ item, path, size }) => ({
      path,
      name: item.file.name,
      size: item.file.size,
      mime: item.file.type || "application/octet-stream",
      kind: attachmentKind(item.file.type),
      ...size,
      ...(item.spoiler && { spoiler: true }),
    }))
    useUploadStore.getState().track(
      id,
      files.map(({ item, path }) => ({ path, file: item.file, previewUrl: item.previewUrl }))
    )
    const message = newLocalMessage({
      id,
      channelId: channel.id,
      authorId: userId,
      content,
      replyToId: replyTo ?? null,
      attachments: attachments as unknown as Json,
    })
    setDraft(channel.id, "")
    setReplyTo(channel.id, undefined)
    useUploadStore.getState().clearStaged(channel.id)
    notifyStopped()
    sendMessage.mutate(message, { onError: (e) => toast.error(errorMessage(e)) })
    slowmode.started()
    onSent()
  }

  function addFiles(files: File[]) {
    if (!canAttach) {
      toast.error("You don't have permission to attach files here.")
      return
    }
    stageFiles(channel.id, files)
  }

  function editLastMessage() {
    const data = queryClient.getQueryData<InfiniteData<MessagePage>>(qk.messages(channel.id))
    const mine = flattenPages(data?.pages ?? []).findLast((m) => m.author_id === userId && !m.status)
    if (mine) setEditing(mine.id)
  }

  if (!canSend) {
    return (
      <div className="shrink-0 px-4 pb-6">
        <div className="flex min-h-11 items-center gap-2 rounded-lg bg-composer px-4 py-2 text-sm text-muted-foreground">
          {timedOutUntil ? (
            <>
              <ClockIcon className="size-4 shrink-0 text-mention" />
              You&apos;re timed out until {format(new Date(timedOutUntil), "MMM d, h:mm a")}. You can
              read messages, but you can&apos;t send any.
            </>
          ) : (
            "You do not have permission to send messages in this channel."
          )}
        </div>
      </div>
    )
  }

  const remaining = MAX_LENGTH - draft.length

  return (
    <div className="shrink-0 px-4">
      {replyTo && <ReplyBar messageId={replyTo} onCancel={() => setReplyTo(channel.id, undefined)} />}
      {staged.length > 0 && <AttachmentTray channelId={channel.id} items={staged} rounded={!replyTo} />}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
        className={cn(
          "relative flex items-start gap-1 rounded-lg bg-composer pr-2",
          (replyTo || staged.length > 0) && "rounded-t-none"
        )}
      >
        {mentions.popup && <MentionPopup {...mentions.popup} />}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Upload a file"
              disabled={!canAttach}
              onClick={() => fileInputRef.current?.click()}
              className="flex size-11 shrink-0 items-center justify-center text-interactive hover:text-interactive-hover disabled:opacity-50"
            >
              <PlusCircleIcon className="size-6" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Upload a file</TooltipContent>
        </Tooltip>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          disabled={!canAttach}
          onChange={(e) => {
            addFiles([...(e.target.files ?? [])])
            e.target.value = ""
          }}
        />
        <textarea
          id={composerInputId(channel.id)}
          ref={inputRef}
          rows={1}
          value={draft}
          placeholder={`Message ${channelLabel}`}
          aria-label={`Message ${channelLabel}`}
          onChange={(e) => {
            setDraft(channel.id, e.target.value)
            mentions.updateTrigger()
            if (e.target.value.trim()) notifyTyping()
            else notifyStopped()
          }}
          onSelect={mentions.updateTrigger}
          onPaste={(e) => {
            const files = [...e.clipboardData.files]
            if (files.length > 0) {
              e.preventDefault()
              addFiles(files)
            }
          }}
          onBlur={() => setTimeout(mentions.updateTrigger, 0)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return
            if (mentions.onKeyDown(e)) return
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void send()
            } else if (e.key === "Escape" && replyTo) {
              e.preventDefault()
              setReplyTo(channel.id, undefined)
            } else if (e.key === "ArrowUp" && !draft) {
              e.preventDefault()
              editLastMessage()
            }
          }}
          className="max-h-[50vh] min-h-11 flex-1 resize-none bg-transparent py-[11px] leading-[1.375rem] text-foreground outline-none placeholder:text-muted-foreground/70"
        />
        <EmojiPickerPopover
          onPick={(picked) => {
            const el = inputRef.current
            const at = el?.selectionStart ?? draft.length
            const custom = parseCustomEmoji(picked)
            const emoji = custom ? `:${custom.name}: ` : picked
            setDraft(channel.id, draft.slice(0, at) + emoji + draft.slice(at))
            requestAnimationFrame(() => {
              el?.focus()
              el?.setSelectionRange(at + emoji.length, at + emoji.length)
            })
          }}
        >
          <button
            type="button"
            aria-label="Emoji"
            className="flex size-11 shrink-0 items-center justify-center text-interactive hover:text-interactive-hover"
          >
            <SmileIcon className="size-6" />
          </button>
        </EmojiPickerPopover>
        {remaining < 200 && (
          <span
            className={cn(
              "absolute right-3 bottom-1 text-xs",
              remaining < 0 ? "text-mention" : "text-muted-foreground"
            )}
          >
            {remaining}
          </span>
        )}
      </form>
      <div className="relative">
        <TypingIndicator />
        {slowmode.active && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="absolute top-0 right-1 flex h-6 items-center gap-1 text-xs text-muted-foreground">
                <HourglassIcon className="size-3.5" />
                {slowmode.remaining > 0 ? `${slowmode.remaining}s` : "Slowmode is enabled"}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Members can send one message every {formatSlowmode(slowmode.seconds)}.
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
