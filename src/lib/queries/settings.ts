"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"

import {
  getMySettings,
  listNotificationSettings,
  markChannelRead,
  markServerRead,
  setMyStatus,
  setNotificationSettings,
  type ChosenStatus,
  type NotificationLevel,
  type NotificationSetting,
  type UserSettings,
} from "@/lib/api/settings"
import { indexPrefs } from "@/lib/notifications"
import { useUserId } from "@/lib/stores/auth-store"
import { useUnreadStore } from "@/lib/stores/unread-store"

import { qk } from "./keys"

export function useMySettings() {
  const userId = useUserId()
  return useQuery({
    queryKey: qk.mySettings(userId),
    queryFn: () => getMySettings(userId),
    staleTime: Infinity,
  })
}

/** The status the user picked (Online, Idle, Do Not Disturb, Invisible). */
export function useChosenStatus(): ChosenStatus {
  return useMySettings().data?.status ?? "online"
}

export function useSetStatus() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (status: ChosenStatus) => setMyStatus(userId, status),
    onMutate: (status) =>
      queryClient.setQueryData<UserSettings>(qk.mySettings(userId), (old) => (old ? { ...old, status } : old)),
    onSuccess: (settings) => queryClient.setQueryData(qk.mySettings(userId), settings),
  })
}

export function useNotificationSettings() {
  const userId = useUserId()
  return useQuery({
    queryKey: qk.notificationSettings(userId),
    queryFn: listNotificationSettings,
    staleTime: Infinity,
  })
}

export function useNotificationPrefs() {
  const { data } = useNotificationSettings()
  return useMemo(() => indexPrefs(data), [data])
}

export function useSetNotificationSettings() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      serverId?: string
      channelId?: string
      level?: NotificationLevel | null
      mutedUntil?: Date | "forever" | null
    }) => setNotificationSettings(input),
    onSuccess: (saved) =>
      queryClient.setQueryData<NotificationSetting[]>(qk.notificationSettings(userId), (list) => {
        const rest = (list ?? []).filter((r) => r.id !== saved.id)
        return [...rest, saved]
      }),
  })
}

export function useMarkServerRead() {
  return useMutation({
    mutationFn: async (serverId: string) => {
      const { channels, markRead } = useUnreadStore.getState()
      for (const [channelId, entry] of Object.entries(channels)) {
        if (entry.serverId === serverId && entry.lastMessageAt) markRead(channelId, entry.lastMessageAt)
      }
      await markServerRead(serverId)
    },
  })
}

export function useMarkChannelRead() {
  return useMutation({
    mutationFn: async (channelId: string) => {
      const entry = useUnreadStore.getState().channels[channelId]
      if (entry?.lastMessageAt) useUnreadStore.getState().markRead(channelId, entry.lastMessageAt)
      await markChannelRead(channelId)
    },
  })
}
