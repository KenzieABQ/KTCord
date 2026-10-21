"use client"

import { format } from "date-fns"
import { ArrowDownIcon } from "lucide-react"
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import { toast } from "sonner"

import { MessageFeedSkeleton } from "@/components/layout/skeletons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import type { Channel } from "@/lib/api/channels"
import { errorMessage } from "@/lib/api/errors"
import { markRead } from "@/lib/api/messages"
import { firstUnreadIndex, flattenPages, isGroupedWith, startsNewDay } from "@/lib/messages/feed"
import type { ChatMessage } from "@/lib/messages/types"
import { useDeleteMessage, useMessages } from "@/lib/queries/messages"
import { MARK_READ_EVENT } from "@/lib/shortcuts"
import { useUserId } from "@/lib/stores/auth-store"
import { isChannelUnread, useUnreadStore } from "@/lib/stores/unread-store"

import { useChat } from "./chat-context"
import { DayDivider, MessageItem, NewMessagesDivider } from "./message-item"

/** Virtuoso needs a large positive base index so older pages can be prepended above it. */
const START_INDEX = 1_000_000
const MAX_PAGES_FOR_JUMP = 20

export type MessageFeedHandle = {
  jumpToMessage: (id: string) => void
  scrollToBottom: () => void
}

type FeedContext = { welcome: ReactNode; hasMore: boolean }

function FeedHeader({ context }: { context?: FeedContext }) {
  if (!context) return null
  return context.hasMore ? <MessageFeedSkeleton rows={3} /> : context.welcome
}

function FeedFooter() {
  return <div className="h-6" />
}

const components = { Header: FeedHeader, Footer: FeedFooter }

function useWindowFocused() {
  const [focused, setFocused] = useState(() => typeof document !== "undefined" && document.hasFocus())
  useEffect(() => {
    const update = () => setFocused(document.hasFocus() && document.visibilityState === "visible")
    window.addEventListener("focus", update)
    window.addEventListener("blur", update)
    document.addEventListener("visibilitychange", update)
    return () => {
      window.removeEventListener("focus", update)
      window.removeEventListener("blur", update)
      document.removeEventListener("visibilitychange", update)
    }
  }, [])
  return focused
}

/**
 * The channel's message history: virtualized, newest at the bottom, older pages load on
 * scroll-up. Shows day dividers, the "New" divider, an unread bar and Jump to Present,
 * and marks the channel read while you're at the bottom of a focused window.
 */
export function MessageFeed({
  channel,
  welcome,
  initialJumpId,
  ref,
}: {
  channel: Channel
  /** Shown above the oldest message ("This is the beginning of …"). */
  welcome: ReactNode
  initialJumpId?: string
  ref?: Ref<MessageFeedHandle>
}) {
  const userId = useUserId()
  const { channelLabel } = useChat()
  const reducedMotion = useReducedMotion()
  const query = useMessages(channel.id)
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query
  const virtuoso = useRef<VirtuosoHandle>(null)
  const deleteMessage = useDeleteMessage(channel.id)
  const setActive = useUnreadStore((s) => s.setActive)
  const focused = useWindowFocused()

  const pages = useMemo(() => query.data?.pages ?? [], [query.data])
  const messages = useMemo(() => flattenPages(pages), [pages])

  // Lower firstItemIndex by however many messages each older page prepends.
  const [indexState, setIndexState] = useState({ pages: 0, first: START_INDEX })
  if (pages.length !== indexState.pages) {
    const older = pages.slice(1).reduce((n, p) => n + p.messages.length, 0)
    setIndexState({ pages: pages.length, first: START_INDEX - older })
  }
  const firstItemIndex = indexState.first

  // The read marker when the channel opened: the "New" divider stays put while you read.
  const [dividerAt] = useState(() => {
    const entry = useUnreadStore.getState().channels[channel.id]
    return isChannelUnread(entry) ? entry!.lastReadAt : null
  })
  const dividerIndex = firstUnreadIndex(messages, dividerAt, userId)
  const [unreadBarDismissed, setUnreadBarDismissed] = useState(false)
  const [dividerVisible, setDividerVisible] = useState(false)

  // Escape marks the channel read, which also dismisses the "new messages" bar.
  useEffect(() => {
    function onMarkRead(e: Event) {
      if ((e as CustomEvent<string>).detail === channel.id) setUnreadBarDismissed(true)
    }
    window.addEventListener(MARK_READ_EVENT, onMarkRead)
    return () => window.removeEventListener(MARK_READ_EVENT, onMarkRead)
  }, [channel.id])

  const [atBottom, setAtBottom] = useState(true)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ChatMessage | null>(null)

  useEffect(() => {
    setActive({ channelId: channel.id, atBottom })
    return () => setActive(null)
  }, [channel.id, atBottom, setActive])

  // Mark read when the newest message is visible in a focused window (debounced).
  const latest = useMemo(() => [...messages].reverse().find((m) => !m.status), [messages])
  useEffect(() => {
    if (!latest || !atBottom || !focused) return
    useUnreadStore.getState().markRead(channel.id, latest.created_at)
    const timer = setTimeout(() => {
      markRead(channel.id, latest.id).catch(() => {
        // Not fatal: the next new message or focus retries.
      })
    }, 600)
    return () => clearTimeout(timer)
  }, [channel.id, latest, atBottom, focused])

  const loadOlder = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const highlight = useCallback((id: string) => {
    setHighlightId(id)
    setTimeout(() => setHighlightId((current) => (current === id ? null : current)), 2000)
  }, [])

  // Scroll to a message, loading older pages until it's found (or history runs out).
  const messagesRef = useRef(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const jumpToMessage = useCallback(
    async (id: string) => {
      let list = messagesRef.current
      let index = list.findIndex((m) => m.id === id)
      for (let i = 0; index === -1 && i < MAX_PAGES_FOR_JUMP; i++) {
        const result = await fetchNextPage()
        list = flattenPages(result.data?.pages ?? [])
        index = list.findIndex((m) => m.id === id)
        if (!result.hasNextPage) break
      }
      if (index === -1) {
        toast("That message couldn't be found. It may have been deleted.")
        return
      }
      // Let Virtuoso render the newly prepended items before scrolling.
      requestAnimationFrame(() => {
        virtuoso.current?.scrollToIndex({ index, align: "center", behavior: "auto" })
        highlight(id)
      })
    },
    [fetchNextPage, highlight]
  )

  const scrollToBottom = useCallback(() => {
    virtuoso.current?.scrollToIndex({ index: "LAST", align: "end", behavior: "auto" })
  }, [])

  useImperativeHandle(ref, () => ({ jumpToMessage: (id) => void jumpToMessage(id), scrollToBottom }), [
    jumpToMessage,
    scrollToBottom,
  ])

  // Message links (/channels/:server/:channel/:message) jump once the first page is in.
  const jumpedRef = useRef(false)
  useEffect(() => {
    if (!initialJumpId || jumpedRef.current || !query.data) return
    jumpedRef.current = true
    void jumpToMessage(initialJumpId)
  }, [initialJumpId, query.data, jumpToMessage])

  const requestDelete = useCallback(
    (message: ChatMessage, skipConfirm: boolean) => {
      if (skipConfirm) {
        deleteMessage.mutate(message, { onError: (e) => toast.error(errorMessage(e)) })
      } else {
        setPendingDelete(message)
      }
    },
    [deleteMessage]
  )

  if (query.isPending) {
    return (
      <div className="flex flex-1 flex-col justify-end overflow-hidden">
        <MessageFeedSkeleton />
      </div>
    )
  }
  if (query.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-muted-foreground">Messages failed to load. {errorMessage(query.error)}</p>
        <Button variant="secondary" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const unreadCount = dividerIndex === -1 ? 0 : messages.length - dividerIndex
  const showUnreadBar = dividerIndex !== -1 && !unreadBarDismissed && !dividerVisible

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {showUnreadBar && (
        <div className="absolute inset-x-4 top-0 z-20 flex h-8 items-center justify-between rounded-b-lg bg-primary px-3 text-sm font-medium text-white shadow">
          <button
            type="button"
            className="truncate hover:underline"
            onClick={() =>
              virtuoso.current?.scrollToIndex({ index: dividerIndex, align: "start", behavior: reducedMotion ? "auto" : "smooth" })
            }
          >
            {unreadCount}
            {pages.at(-1)?.hasMore && unreadCount >= messages.length ? "+" : ""} new{" "}
            {unreadCount === 1 ? "message" : "messages"} since{" "}
            {dividerAt ? format(new Date(dividerAt), "h:mm a") : "you were here"}
          </button>
          <button type="button" className="shrink-0 hover:underline" onClick={() => setUnreadBarDismissed(true)}>
            Mark As Read
          </button>
        </div>
      )}

      <Virtuoso<ChatMessage, FeedContext>
        ref={virtuoso}
        className="scrollbar-thin chat-text flex-1"
        role="log"
        aria-label={`Messages in ${channelLabel}`}
        data-message-feed=""
        data={messages}
        context={{ welcome, hasMore: Boolean(hasNextPage) }}
        firstItemIndex={firstItemIndex}
        // Open at the newest message, aligned to the bottom edge even in short windows.
        initialTopMostItemIndex={{ index: Math.max(0, messages.length - 1), align: "end" }}
        alignToBottom
        computeItemKey={(_, message) => message.id}
        components={components}
        startReached={loadOlder}
        increaseViewportBy={{ top: 600, bottom: 200 }}
        atBottomThreshold={80}
        atBottomStateChange={setAtBottom}
        followOutput={(isAtBottom) => {
          const last = messagesRef.current.at(-1)
          if (last?.author_id === userId && last.status === "sending") return "auto"
          return isAtBottom ? (reducedMotion ? "auto" : "smooth") : false
        }}
        rangeChanged={({ startIndex, endIndex }) => {
          if (dividerIndex === -1) return
          const absolute = firstItemIndex + dividerIndex
          setDividerVisible(absolute >= startIndex && absolute <= endIndex)
        }}
        itemContent={(index, message) => {
          const i = index - firstItemIndex
          const prev = messages[i - 1]
          const newDay = startsNewDay(prev, message)
          const isDivider = i === dividerIndex
          return (
            <div>
              {newDay && <DayDivider iso={message.created_at} />}
              {isDivider && <NewMessagesDivider />}
              <MessageItem
                message={message}
                grouped={!newDay && !isDivider && isGroupedWith(prev, message)}
                highlighted={highlightId === message.id}
                onDeleteRequest={requestDelete}
              />
            </div>
          )
        }}
      />

      {!atBottom && (
        <div className="absolute inset-x-4 bottom-2 z-20 flex justify-center">
          <button
            type="button"
            onClick={scrollToBottom}
            className="flex items-center gap-2 rounded-full bg-floating px-4 py-1.5 text-sm font-medium text-header shadow-lg ring-1 ring-border hover:bg-sidebar"
          >
            You&apos;re viewing older messages
            <span className="flex items-center gap-1 text-link">
              Jump to Present <ArrowDownIcon className="size-4" />
            </span>
          </button>
        </div>
      )}

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent className="bg-chat">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this message?</AlertDialogDescription>
          </AlertDialogHeader>
          {pendingDelete && (
            <div className="max-h-48 overflow-hidden rounded-md border border-border bg-sidebar p-3 text-sm whitespace-pre-wrap text-foreground shadow-inner">
              {pendingDelete.content}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            <span className="font-bold text-status-online uppercase">Protip:</span> hold Shift while
            hovering a message to delete it without this prompt.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/80"
              onClick={() => {
                if (pendingDelete) requestDelete(pendingDelete, true)
                setPendingDelete(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
