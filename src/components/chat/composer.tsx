"use client"

import { useQueryClient, type InfiniteData } from "@tanstack/react-query"
import { format } from "date-fns"
import { ClockIcon, PlusCircleIcon, SmileIcon, XIcon } from "lucide-react"
import { useRef } from "react"
import { toast } from "sonner"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAutosize } from "@/hooks/use-autosize"
import { encodeMentions } from "@/lib/mentions"
import { flattenPages } from "@/lib/messages/feed"
import { newLocalMessage, type MessagePage } from "@/lib/messages/types"
import { qk } from "@/lib/queries/keys"
import { findCachedMessage, useSendMessage } from "@/lib/queries/messages"
import { useTypingChannel } from "@/lib/realtime/use-typing-channel"
import { useUserId } from "@/lib/stores/auth-store"
import { useComposerStore } from "@/lib/stores/composer-store"
import { cn } from "@/lib/utils"

import { useChat } from "./chat-context"
import { MentionPopup } from "./mention-popup"
import { TypingIndicator } from "./typing-indicator"
import { useMentionAutocomplete } from "./use-mention-autocomplete"
import { useAuthor } from "./use-author"

const MAX_LENGTH = 2000

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
export function Composer({ onSent }: { onSent: () => void }) {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const { channel, canSend, timedOutUntil, mentionSources } = useChat()
  const draft = useComposerStore((s) => s.drafts[channel.id] ?? "")
  const replyTo = useComposerStore((s) => s.replyTo[channel.id])
  const { setDraft, setReplyTo, setEditing } = useComposerStore.getState()
  const sendMessage = useSendMessage(channel.id)
  const { notifyTyping, notifyStopped } = useTypingChannel(channel.id)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  useAutosize(inputRef, draft)
  const mentions = useMentionAutocomplete(inputRef, draft, (next) => setDraft(channel.id, next))

  function send() {
    const content = encodeMentions(draft.trim(), mentionSources)
    if (!content) return
    if (content.length > MAX_LENGTH) {
      toast.error(`Messages can be up to ${MAX_LENGTH} characters. Yours is ${content.length}.`)
      return
    }
    const message = newLocalMessage({
      id: crypto.randomUUID(),
      channelId: channel.id,
      authorId: userId,
      content,
      replyToId: replyTo ?? null,
    })
    setDraft(channel.id, "")
    setReplyTo(channel.id, undefined)
    notifyStopped()
    sendMessage.mutate(message)
    onSent()
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
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        className={cn("relative flex items-start gap-1 rounded-lg bg-composer pr-2", replyTo && "rounded-t-none")}
      >
        {mentions.popup && <MentionPopup {...mentions.popup} />}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Upload a file"
              disabled
              className="flex size-11 shrink-0 items-center justify-center text-interactive hover:text-interactive-hover disabled:opacity-50"
            >
              <PlusCircleIcon className="size-6" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Uploads arrive with rich media</TooltipContent>
        </Tooltip>
        <textarea
          id="composer-input"
          ref={inputRef}
          rows={1}
          value={draft}
          placeholder={`Message #${channel.name}`}
          aria-label={`Message #${channel.name}`}
          onChange={(e) => {
            setDraft(channel.id, e.target.value)
            mentions.updateTrigger()
            if (e.target.value.trim()) notifyTyping()
            else notifyStopped()
          }}
          onSelect={mentions.updateTrigger}
          onBlur={() => setTimeout(mentions.updateTrigger, 0)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return
            if (mentions.onKeyDown(e)) return
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
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
        <button
          type="button"
          aria-label="Emoji"
          disabled
          className="flex size-11 shrink-0 items-center justify-center text-interactive disabled:opacity-50"
        >
          <SmileIcon className="size-6" />
        </button>
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
      <TypingIndicator />
    </div>
  )
}
