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
  deleteMessage,
  editMessage,
  fetchMessages,
  fetchMessagesById,
  getUnreadState,
  sendMessage,
} from "@/lib/api/messages"
import type { Profile } from "@/lib/api/profiles"
import { getProfile } from "@/lib/api/profiles"
import { patchInPages, removeFromPages, upsertIntoPages } from "@/lib/messages/feed"
import type { ChatMessage, Cursor, MessagePage } from "@/lib/messages/types"
import { useUserId } from "@/lib/stores/auth-store"
import { useUnreadStore } from "@/lib/stores/unread-store"
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

export function useSendMessage(channelId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (message: ChatMessage) =>
      sendMessage({
        id: message.id,
        channelId,
        content: message.content,
        replyToId: message.reply_to_id,
        attachments: message.attachments,
      }),
    onMutate: (message) =>
      updateMessagePages(queryClient, channelId, (pages) =>
        upsertIntoPages(pages, { ...message, status: "sending" })
      ),
    onSuccess: (saved) => {
      updateMessagePages(queryClient, channelId, (pages) => upsertIntoPages(pages, saved))
      useUnreadStore.getState().markRead(channelId, saved.created_at)
    },
    onError: (_error, message) =>
      updateMessagePages(queryClient, channelId, (pages) =>
        patchInPages(pages, message.id, (m) => ({ ...m, status: "failed" }))
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
