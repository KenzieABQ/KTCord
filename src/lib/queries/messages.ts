"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query"
import { useEffect } from "react"

import {
  addReaction,
  createThread,
  deleteMessage,
  editMessage,
  fetchMessages,
  fetchMessagesById,
  getChannelById,
  getUnreadState,
  listPins,
  listThreads,
  markUnread,
  pinMessage,
  removeReaction,
  searchMessages,
  sendMessage,
  type SearchParams,
} from "@/lib/api/messages"
import { errorMessage } from "@/lib/api/errors"
import type { Profile } from "@/lib/api/profiles"
import { getProfile } from "@/lib/api/profiles"
import { isAutomodBlock } from "@/lib/automod"
import { patchInPages, removeFromPages, upsertIntoPages } from "@/lib/messages/feed"
import { forwardOf, pollOf, type ChatMessage, type Cursor, type MessagePage } from "@/lib/messages/types"
import { useUserId } from "@/lib/stores/auth-store"
import { useUnreadStore } from "@/lib/stores/unread-store"
import { uploadAttachment } from "@/lib/api/attachments"
import { useUploadStore } from "@/lib/stores/upload-store"
import { getSupabase } from "@/lib/supabase/client"

import { qk } from "./keys"

type Pages = InfiniteData<MessagePage, Cursor | null>

/** Applies `fn` to a channel's cached pages, if that channel has been loaded. */
export function updateMessagePages(
  queryClient: QueryClient,
  channelId: string,
  fn: (pages: MessagePage[]) => MessagePage[]
) {
  queryClient.setQueryData<Pages>(qk.messages(channelId), (data) =>
    data ? { ...data, pages: fn(data.pages) } : data
  )
}

/** Finds a message in any loaded channel. */
export function findCachedMessage(queryClient: QueryClient, id: string): ChatMessage | undefined {
  for (const [, data] of queryClient.getQueriesData<Pages>({ queryKey: ["messages"] })) {
    for (const page of data?.pages ?? []) {
      const hit = page.messages.find((m) => m.id === id)
      if (hit) return hit
    }
  }
  return queryClient.getQueryData<ChatMessage>(qk.message(id))
}

/** Loads replied-to messages and unknown authors for a page in two batched queries. */
async function primePage(queryClient: QueryClient, messages: ChatMessage[]) {
  const replyIds = [
    ...new Set(
      messages
        .map((m) => m.reply_to_id)
        .filter((id): id is string => Boolean(id) && !findCachedMessage(queryClient, id!))
    ),
  ]
  const referenced = await fetchMessagesById(replyIds)
  for (const m of referenced) queryClient.setQueryData(qk.message(m.id), m)

  const authorIds = [
    ...new Set(
      [...messages, ...referenced]
        .map((m) => m.author_id)
        .filter((id): id is string => Boolean(id) && !queryClient.getQueryData(qk.profile(id!)))
    ),
  ]
  if (authorIds.length) {
    const { data } = await getSupabase().from("profiles").select("*").in("id", authorIds)
    for (const profile of (data ?? []) as Profile[]) {
      queryClient.setQueryData(qk.profile(profile.id), profile)
    }
  }
}

export function useMessages(channelId: string) {
  const queryClient = useQueryClient()
  return useInfiniteQuery({
    queryKey: qk.messages(channelId),
    queryFn: async ({ pageParam }) => {
      const page = await fetchMessages(channelId, pageParam)
      await primePage(queryClient, page.messages)
      return page
    },
    initialPageParam: null as Cursor | null,
    getNextPageParam: (last) =>
      last.hasMore && last.messages[0]
        ? { createdAt: last.messages[0].created_at, id: last.messages[0].id }
        : undefined,
    // Realtime keeps loaded channels current; reconnects refetch everything.
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  })
}

/** A replied-to message: from the loaded feed if present, else fetched once. */
export function useReferencedMessage(id: string | null) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: qk.message(id ?? ""),
    queryFn: async () => (await fetchMessagesById([id!]))[0] ?? null,
    enabled: Boolean(id),
    initialData: () => (id ? (findCachedMessage(queryClient, id) ?? undefined) : undefined),
    staleTime: Infinity,
  })
}

/** Uploads a message's files (skipping finished ones on retry), then posts it. */
async function uploadThenSend(channelId: string, message: ChatMessage) {
  const { files, progress, setProgress, done } = useUploadStore.getState()
  for (const { path, file } of files[message.id] ?? []) {
    if (progress[path] === 1) continue
    await uploadAttachment(path, file, (f) => setProgress(path, f))
  }
  const poll = pollOf(message)
  const saved = await sendMessage({
    id: message.id,
    channelId,
    content: message.content,
    replyToId: message.reply_to_id,
    attachments: message.attachments,
    replyPing: message.reply_ping,
    forwardId: forwardOf(message)?.message_id,
    poll: poll && {
      question: poll.question,
      answers: poll.answers.map(({ text, emoji }) => ({ text, emoji })),
      multiselect: poll.multiselect,
      // A local poll ends `duration` after it was written.
      duration_hours: Math.round((Date.parse(poll.expires_at) - Date.parse(message.created_at)) / 3_600_000),
    },
  })
  done(message.id)
  return saved
}

export function useSendMessage(channelId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (message: ChatMessage) => uploadThenSend(channelId, message),
    onMutate: (message) =>
      updateMessagePages(queryClient, channelId, (pages) =>
        upsertIntoPages(pages, { ...message, status: "sending" })
      ),
    onSuccess: (saved) => {
      updateMessagePages(queryClient, channelId, (pages) =>
        upsertIntoPages(pages, { ...saved, reactions: [], thread: null })
      )
      useUnreadStore.getState().markRead(channelId, saved.created_at)
    },
    onError: (error, message) =>
      updateMessagePages(queryClient, channelId, (pages) =>
        // AutoMod's verdict won't change on retry, so a blocked message just goes away.
        isAutomodBlock(errorMessage(error))
          ? removeFromPages(pages, message.id)
          : patchInPages(pages, message.id, (m) => ({ ...m, status: "failed" }))
      ),
  })
}

export function useEditMessage(channelId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => editMessage(id, content),
    onMutate: ({ id, content }) => {
      const previous = findCachedMessage(queryClient, id)
      updateMessagePages(queryClient, channelId, (pages) =>
        patchInPages(pages, id, (m) => ({ ...m, content, edited_at: new Date().toISOString() }))
      )
      return { previous }
    },
    onSuccess: (saved) =>
      updateMessagePages(queryClient, channelId, (pages) => upsertIntoPages(pages, saved)),
    onError: (_error, _input, context) => {
      if (context?.previous) {
        const previous = context.previous
        updateMessagePages(queryClient, channelId, (pages) => upsertIntoPages(pages, previous))
      }
    },
  })
}

export function useDeleteMessage(channelId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (message: ChatMessage) =>
      // A message that never reached the server only needs to disappear locally.
      message.status ? Promise.resolve() : deleteMessage(message.id),
    onMutate: (message) =>
      updateMessagePages(queryClient, channelId, (pages) => removeFromPages(pages, message.id)),
    onError: (_error, message) =>
      updateMessagePages(queryClient, channelId, (pages) => upsertIntoPages(pages, message)),
  })
}

/** Mark Unread: moves your read marker back to just before a message. */
export function useMarkUnread() {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: ({ channelId, messageId }: { channelId: string; messageId: string }) => markUnread(channelId, messageId),
    onSuccess: (at, { channelId }) => {
      useUnreadStore.getState().markUnread(channelId, at, true)
      // Recount the mentions after the new marker.
      void queryClient.invalidateQueries({ queryKey: qk.unreadState(userId) })
    },
  })
}

/** Loads unread state on start (and after reconnects, via invalidation) into the unread store. */
export function useUnreadHydration() {
  const userId = useUserId()
  const hydrate = useUnreadStore((s) => s.hydrate)
  const { data } = useQuery({
    queryKey: qk.unreadState(userId),
    queryFn: getUnreadState,
    staleTime: Infinity,
  })
  useEffect(() => {
    if (data) hydrate(data)
  }, [data, hydrate])
}

export async function loadProfile(queryClient: QueryClient, userId: string) {
  return queryClient.fetchQuery({
    queryKey: qk.profile(userId),
    queryFn: () => getProfile(userId),
    staleTime: 5 * 60_000,
  })
}

// ---------------------------------------------------------------------------
// Reactions, pins, threads, search
// ---------------------------------------------------------------------------

/** Toggles your reaction on a message, optimistically. */
export function useToggleReaction(channelId: string) {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: async ({ message, emoji }: { message: ChatMessage; emoji: string }) => {
      const mine = message.reactions?.some((r) => r.user_id === userId && r.emoji === emoji)
      if (mine) await removeReaction(message.id, userId, emoji)
      else await addReaction(message, emoji)
    },
    onMutate: ({ message, emoji }) => {
      const mine = message.reactions?.some((r) => r.user_id === userId && r.emoji === emoji)
      updateMessagePages(queryClient, channelId, (pages) =>
        patchInPages(pages, message.id, (m) => ({
          ...m,
          reactions: mine
            ? (m.reactions ?? []).filter((r) => !(r.user_id === userId && r.emoji === emoji))
            : [...(m.reactions ?? []), { id: `local-${crypto.randomUUID()}`, user_id: userId, emoji }],
        }))
      )
      return { previous: message.reactions ?? [] }
    },
    onError: (_e, { message }, context) =>
      updateMessagePages(queryClient, channelId, (pages) =>
        patchInPages(pages, message.id, (m) => ({ ...m, reactions: context?.previous ?? m.reactions }))
      ),
  })
}

export function usePins(channelId: string, enabled: boolean) {
  return useQuery({ queryKey: qk.pins(channelId), queryFn: () => listPins(channelId), enabled })
}

export function usePinMessage(channelId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ messageId, pinned }: { messageId: string; pinned: boolean }) => pinMessage(messageId, pinned),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.pins(channelId) }),
  })
}

export function useThreads(channelId: string, enabled: boolean) {
  return useQuery({ queryKey: qk.threads(channelId), queryFn: () => listThreads(channelId), enabled })
}

export function useThreadChannel(threadId: string | null) {
  return useQuery({
    queryKey: qk.thread(threadId ?? ""),
    queryFn: () => getChannelById(threadId!),
    enabled: Boolean(threadId),
    staleTime: 5 * 60_000,
  })
}

export function useCreateThread(channelId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ messageId, name }: { messageId: string; name: string }) => createThread(messageId, name),
    onSuccess: (threadId, { messageId, name }) => {
      updateMessagePages(queryClient, channelId, (pages) =>
        patchInPages(pages, messageId, (m) => ({
          ...m,
          thread: m.thread ?? { id: threadId, name: name || "Thread", message_count: 0, last_message_at: null },
        }))
      )
      void queryClient.invalidateQueries({ queryKey: qk.threads(channelId) })
    },
  })
}

export function useSearch(scope: string, params: SearchParams | null) {
  return useInfiniteQuery({
    queryKey: qk.search(scope, JSON.stringify(params)),
    queryFn: ({ pageParam }) => searchMessages({ ...params!, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.messages.length, 0)
      return loaded < last.total && last.messages.length > 0 ? loaded : undefined
    },
    enabled: Boolean(params),
  })
}
