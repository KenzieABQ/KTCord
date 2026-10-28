import type { QueryClient } from "@tanstack/react-query"
import { toast } from "@/lib/toast"

import type { Channel } from "@/lib/api/channels"
import type { DmChannel } from "@/lib/api/dms"
import type { Member } from "@/lib/api/members"
import type { Profile } from "@/lib/api/profiles"
import type { JoinedServer } from "@/lib/api/servers"
import { parseMarkdown, toPlainText } from "@/lib/markdown/parse"
import { memberDisplayName } from "@/lib/members"
import { previewText, type ChatMessage } from "@/lib/messages/types"
import { displayNameOf } from "@/lib/profile-display"
import { qk } from "@/lib/queries/keys"
import { playNotificationSound } from "@/lib/sound"
import { usePrefsStore } from "@/lib/stores/prefs-store"

type Router = { push: (href: string) => void }

/**
 * Notifies about an incoming message the way this device's settings ask: a desktop
 * notification while the tab is in the background (if allowed), otherwise (for DMs only)
 * an in-app message card, plus an optional chime.
 */
export function notifyMessage(
  queryClient: QueryClient,
  router: Router,
  userId: string,
  message: ChatMessage,
  where: { serverId: string | null; isDm: boolean }
) {
  const members = where.serverId ? queryClient.getQueryData<Member[]>(qk.members(where.serverId)) : undefined
  const dm = where.isDm
    ? queryClient.getQueryData<DmChannel[]>(qk.dms(userId))?.find((d) => d.id === message.channel_id)
    : undefined
  const channel = where.serverId
    ? queryClient.getQueryData<Channel[]>(qk.channels(where.serverId))?.find((c) => c.id === message.channel_id)
    : undefined
  const server = where.serverId
    ? queryClient.getQueryData<JoinedServer[]>(qk.servers(userId))?.find((s) => s.id === where.serverId)
    : undefined

  const nameOf = (id: string) => {
    const member = members?.find((m) => m.user_id === id)
    if (member) return memberDisplayName(member)
    const recipient = dm?.recipients.find((r) => r.user_id === id)
    if (recipient) return recipient.profile.display_name || recipient.profile.username
    return displayNameOf(queryClient.getQueryData<Profile>(qk.profile(id))) || "Someone"
  }

  const author = message.author_id ? nameOf(message.author_id) : "Someone"
  const preview = toPlainText(parseMarkdown(previewText(message)), { user: nameOf }).slice(0, 140) || "Sent an attachment"
  const place = where.isDm
    ? dm?.type === "group_dm"
      ? dm.name || "Group DM"
      : "Direct Message"
    : `#${channel?.name ?? "channel"}${server ? ` · ${server.name}` : ""}`
  const href = where.isDm
    ? `/channels/me/${message.channel_id}`
    : `/channels/${where.serverId}/${message.channel_id}/${message.id}`

  const prefs = usePrefsStore.getState()
  if (prefs.notificationSound) playNotificationSound()

  if (
    prefs.desktopNotifications &&
    typeof document !== "undefined" &&
    document.visibilityState === "hidden" &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    const notification = new Notification(`${author} (${place})`, { body: preview, tag: message.id })
    notification.onclick = () => {
      window.focus()
      router.push(href)
    }
    return
  }

  if (!prefs.inAppToasts || !where.isDm) return
  const avatarUrl =
    dm?.recipients.find((r) => r.user_id === message.author_id)?.profile.avatar_url ??
    queryClient.getQueryData<Profile>(qk.profile(message.author_id ?? ""))?.avatar_url ??
    null
  toast.dm({
    authorId: message.author_id ?? message.id,
    author,
    avatarUrl,
    place,
    preview,
    onOpen: () => router.push(href),
  })
}
