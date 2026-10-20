import { getSupabase } from "@/lib/supabase/client"
import type { Enums, Tables } from "@/lib/supabase/database.types"

import { toApiError, unwrap } from "./errors"

export type UserSettings = Tables<"user_settings">
export type ChosenStatus = Enums<"user_status">
export type NotificationLevel = Enums<"notification_level">
export type NotificationSetting = Tables<"notification_settings">

export async function getMySettings(userId: string): Promise<UserSettings> {
  const row = unwrap(
    await getSupabase().from("user_settings").select("*").eq("user_id", userId).maybeSingle()
  )
  // Accounts created before user_settings existed get a row on first save.
  return row ?? { user_id: userId, status: "online", updated_at: new Date().toISOString() }
}

export async function setMyStatus(userId: string, status: ChosenStatus): Promise<UserSettings> {
  return unwrap(
    await getSupabase()
      .from("user_settings")
      .upsert({ user_id: userId, status }, { onConflict: "user_id" })
      .select("*")
      .single()
  )
}

export async function listNotificationSettings(): Promise<NotificationSetting[]> {
  return unwrap(await getSupabase().from("notification_settings").select("*"))
}

export async function setNotificationSettings(input: {
  serverId?: string
  channelId?: string
  level?: NotificationLevel | null
  mutedUntil?: Date | "forever" | null
}): Promise<NotificationSetting> {
  const { data, error } = await getSupabase().rpc("set_notification_settings", {
    p_server: input.serverId,
    p_channel: input.channelId,
    p_level: input.level ?? undefined,
    p_clear_level: input.level === null,
    p_muted_until:
      input.mutedUntil === "forever" ? "infinity" : input.mutedUntil ? input.mutedUntil.toISOString() : undefined,
    p_clear_mute: input.mutedUntil === null,
  })
  if (error) throw toApiError(error)
  return data
}

export async function markChannelRead(channelId: string) {
  const { error } = await getSupabase().rpc("mark_channel_read", { p_channel: channelId })
  if (error) throw toApiError(error)
}

export async function markServerRead(serverId: string) {
  const { error } = await getSupabase().rpc("mark_server_read", { p_server: serverId })
  if (error) throw toApiError(error)
}
