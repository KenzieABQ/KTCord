"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo } from "react"
import { create } from "zustand"

import {
  createServerEmoji,
  deleteServerEmoji,
  listMyEmojis,
  renameServerEmoji,
  type ServerEmoji,
} from "@/lib/api/emoji"
import { loadEmojiData, type CustomEmoji, type EmojiData } from "@/lib/emoji"
import { useUserId } from "@/lib/stores/auth-store"

import { qk } from "./keys"

export function useMyEmojis() {
  const userId = useUserId()
  return useQuery({ queryKey: qk.myEmojis(userId), queryFn: listMyEmojis, staleTime: 5 * 60_000 })
}

const toCustom = (e: ServerEmoji): CustomEmoji => ({ id: e.id, name: e.name, animated: e.animated, serverId: e.server_id })

/** Custom emoji the user can use, with the open server's first (it wins name clashes). */
export function useCustomEmoji(serverId: string | null): CustomEmoji[] {
  const { data } = useMyEmojis()
  return useMemo(() => {
    const all = (data ?? []).map(toCustom)
    return [...all.filter((e) => e.serverId === serverId), ...all.filter((e) => e.serverId !== serverId)]
  }, [data, serverId])
}

export function useServerEmojis(serverId: string) {
  const { data, ...rest } = useMyEmojis()
  return { ...rest, data: useMemo(() => data?.filter((e) => e.server_id === serverId), [data, serverId]) }
}

// One shared copy of the loaded emoji set for every component that needs it.
const useEmojiDataStore = create<{ data: EmojiData | null }>()(() => ({ data: null }))

/** The standard emoji set, loading it on first use. */
export function useEmojiData(): EmojiData | null {
  const data = useEmojiDataStore((s) => s.data)
  useEffect(() => {
    if (!data) void loadEmojiData().then((loaded) => useEmojiDataStore.setState({ data: loaded }))
  }, [data])
  return data
}

function useInvalidateEmojis() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: qk.myEmojis(userId) })
}

export function useCreateServerEmoji(serverId: string) {
  const invalidate = useInvalidateEmojis()
  return useMutation({
    mutationFn: ({ name, file }: { name: string; file: File }) => createServerEmoji(serverId, name, file),
    onSettled: invalidate,
  })
}

export function useRenameServerEmoji() {
  const invalidate = useInvalidateEmojis()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameServerEmoji(id, name),
    onSettled: invalidate,
  })
}

export function useDeleteServerEmoji() {
  const invalidate = useInvalidateEmojis()
  return useMutation({ mutationFn: deleteServerEmoji, onSettled: invalidate })
}
