import { getSupabase } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/database.types"

import { toApiError, unwrap } from "./errors"
import type { MemberProfile } from "./members"

export type DmRecipient = {
  user_id: string
  hidden: boolean
  joined_at: string
  profile: MemberProfile
}

/** A DM or group DM with its recipients and when it last had a message. */
export type DmChannel = Tables<"channels"> & {
  recipients: DmRecipient[]
  last_message_at: string | null
}

const DM_SELECT =
  "*, recipients:channel_recipients(user_id, hidden, joined_at, profile:profiles!inner(id, username, display_name, avatar_url, banner_color, banner_url, theme_primary, theme_accent, cosmetics, pronouns, bio, custom_status_text, custom_status_emoji, custom_status_expires_at, created_at)), activity:channel_activity(last_message_at)"

type DmRow = Tables<"channels"> & {
  recipients: DmRecipient[]
  activity: { last_message_at: string } | { last_message_at: string }[] | null
}

/** Every DM the user is in, newest activity first (hidden ones included; the UI filters). */
export async function listDms(): Promise<DmChannel[]> {
  const rows = unwrap(
    await getSupabase()
      .from("channels")
      .select(DM_SELECT)
      .in("type", ["dm", "group_dm"])
      .returns<DmRow[]>()
  )
  return rows
    .map(({ activity, ...channel }) => {
      const a = Array.isArray(activity) ? activity[0] : activity
      return { ...channel, last_message_at: a?.last_message_at ?? null }
    })
    .sort((a, b) => (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at))
}

async function rpc<T>(promise: PromiseLike<{ data: unknown; error: Parameters<typeof toApiError>[0] | null }>) {
  const { data, error } = await promise
  if (error) throw toApiError(error)
  return data as T
}

export const openDm = (userId: string) => rpc<string>(getSupabase().rpc("open_dm", { p_user: userId }))
export const createGroupDm = (userIds: string[]) =>
  rpc<string>(getSupabase().rpc("create_group_dm", { p_users: userIds }))
export const addGroupDmRecipients = (channelId: string, userIds: string[]) =>
  rpc<void>(getSupabase().rpc("add_group_dm_recipients", { p_channel: channelId, p_users: userIds }))
export const leaveGroupDm = (channelId: string) =>
  rpc<void>(getSupabase().rpc("leave_group_dm", { p_channel: channelId }))
export const renameGroupDm = (channelId: string, name: string) =>
  rpc<void>(getSupabase().rpc("rename_group_dm", { p_channel: channelId, p_name: name }))
export const closeDm = (channelId: string) => rpc<void>(getSupabase().rpc("close_dm", { p_channel: channelId }))

/** "Ava", "Ava, Ben and Cy", or the group's own name. Never includes the viewer. */
export function dmTitle(dm: Pick<DmChannel, "name" | "recipients">, selfId: string): string {
  if (dm.name) return dm.name
  const others = dm.recipients.filter((r) => r.user_id !== selfId)
  const names = others.map((r) => r.profile.display_name || r.profile.username)
  if (names.length === 0) return "Just you"
  if (names.length <= 3) return names.join(", ")
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`
}
