"use client"

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { toast } from "sonner"

import { notifyMessage } from "@/lib/realtime/notify"
import { useUnreadHydration } from "@/lib/queries/messages"
import { useMySettings, useNotificationSettings } from "@/lib/queries/settings"
import { useDms } from "@/lib/queries/social"
import { usePresenceSync } from "@/lib/realtime/use-presence"
import { useUserId } from "@/lib/stores/auth-store"
import { useVoiceStore } from "@/lib/stores/voice-store"
import { getSupabase } from "@/lib/supabase/client"

import {
  onChannelAccessChange,
  onChannelChange,
  onChannelOverwriteChange,
  onMemberChange,
  onMemberRoleChange,
  onFriendshipChange,
  onMessageChange,
  onNotificationSettingsChange,
  onReactionChange,
  onReadStateChange,
  onRecipientChange,
  onUserSettingsChange,
  onProfileChange,
  onRoleChange,
  onServerChange,
  type DbContext,
} from "./db-handlers"

// supabase-js types the payload loosely; the handlers narrow it per table.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (ctx: DbContext, change: any) => void

const TABLES: Record<string, Handler> = {
  servers: onServerChange,
  server_members: onMemberChange,
  roles: onRoleChange,
  member_roles: onMemberRoleChange,
  channels: onChannelChange,
  channel_role_access: onChannelAccessChange,
  channel_overwrites: onChannelOverwriteChange,
  profiles: onProfileChange,
  messages: onMessageChange,
  read_states: onReadStateChange,
  user_settings: onUserSettingsChange,
  notification_settings: onNotificationSettingsChange,
  friendships: onFriendshipChange,
  channel_recipients: onRecipientChange,
  reactions: onReactionChange,
}

/**
 * One Realtime channel carrying Postgres Changes for every structural table.
 * RLS filters events per subscriber, so this receives exactly what the user may see.
 * After a reconnect, cached data is refetched to cover anything missed while offline.
 */
export function useRealtimeSync() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const router = useRouter()

  useEffect(() => {
    const supabase = getSupabase()
    const ctx: DbContext = {
      queryClient,
      userId,
      onServerLost: (server) => {
        const voice = useVoiceStore.getState()
        if (voice.connection?.serverId === server.id) voice.leave()
        if (window.location.pathname.startsWith(`/channels/${server.id}`)) {
          router.replace("/channels/me")
        }
        toast(`You no longer have access to ${server.name}.`)
      },
      onNotify: (message, where) => notifyMessage(queryClient, router, userId, message, where),
    }

    let channel = supabase.channel(`db-changes:${userId}`)
    for (const [table, handle] of Object.entries(TABLES)) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => handle(ctx, payload)
      )
    }

    let subscribedOnce = false
    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return
      if (subscribedOnce) void queryClient.invalidateQueries()
      subscribedOnce = true
    })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient, router, userId])
}

export function RealtimeSync() {
  useRealtimeSync()
  useUnreadHydration()
  usePresenceSync()
  // Loaded up front so incoming messages can decide on notifications from any view.
  useMySettings()
  useNotificationSettings()
  useDms()
  return null
}
