"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import type { Channel } from "@/lib/api/channels"
import type { Member, Role } from "@/lib/api/members"
import type { MentionSources } from "@/lib/mentions"
import { memberDisplayName } from "@/lib/members"
import { hasPermission, Permission } from "@/lib/permissions"
import { isTimedOut } from "@/lib/moderation"
import { useChannels, useMembers, useRoles, useServerPermissions } from "@/lib/queries/servers"
import { useUserId } from "@/lib/stores/auth-store"

export type ChatContextValue = {
  serverId: string
  channel: Channel
  membersById: Map<string, Member>
  rolesById: Map<string, Role>
  channelsById: Map<string, Channel>
  permissions: number
  canSend: boolean
  /** Set while the signed-in member is timed out (they can read but not post). */
  timedOutUntil: string | null
  canManageMessages: boolean
  canMentionEveryone: boolean
  /** Names for converting readable mentions to tokens and back. */
  mentionSources: MentionSources
  /** Scrolls the feed to a message, loading older history if needed. */
  jumpToMessage: (id: string) => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function useChat(): ChatContextValue {
  const value = useContext(ChatContext)
  if (!value) throw new Error("useChat() must be used inside <ChatProvider>")
  return value
}

/** Lookup tables and permissions shared by every message, the composer and the typing indicator. */
export function ChatProvider({
  serverId,
  channel,
  jumpToMessage,
  children,
}: {
  serverId: string
  channel: Channel
  jumpToMessage: (id: string) => void
  children: ReactNode
}) {
  const { data: members } = useMembers(serverId)
  const { data: roles } = useRoles(serverId)
  const { data: channels } = useChannels(serverId)
  const { permissions } = useServerPermissions(serverId)
  const userId = useUserId()
  // Re-evaluate when a timeout ends so the composer unlocks without a refresh.
  const [clock, setClock] = useState(0)
  const myTimeout = members?.find((m) => m.user_id === userId)?.timeout_until ?? null
  useEffect(() => {
    if (!myTimeout) return
    const ms = new Date(myTimeout).getTime() - Date.now()
    if (ms <= 0 || ms > 2 ** 31 - 1) return
    const timer = setTimeout(() => setClock((n) => n + 1), ms + 250)
    return () => clearTimeout(timer)
  }, [myTimeout])

  const value = useMemo<ChatContextValue>(() => {
    const me = members?.find((m) => m.user_id === userId)
    const timedOutUntil = me && isTimedOut(me) ? me.timeout_until : null
    return {
      serverId,
      channel,
      membersById: new Map((members ?? []).map((m) => [m.user_id, m])),
      rolesById: new Map((roles ?? []).map((r) => [r.id, r])),
      channelsById: new Map((channels ?? []).map((c) => [c.id, c])),
      permissions,
      canSend: hasPermission(permissions, Permission.SEND_MESSAGES) && !timedOutUntil,
      timedOutUntil,
      canManageMessages: hasPermission(permissions, Permission.MANAGE_MESSAGES),
      canMentionEveryone: hasPermission(permissions, Permission.MENTION_EVERYONE),
      mentionSources: {
        users: (members ?? []).map((m) => ({ id: m.user_id, username: m.profile.username, name: memberDisplayName(m) })),
        roles: (roles ?? []).filter((r) => !r.is_default).map((r) => ({ id: r.id, name: r.name })),
        channels: (channels ?? []).filter((c) => c.type === "text").map((c) => ({ id: c.id, name: c.name ?? "" })),
      },
      jumpToMessage,
    }
    // `clock` only forces a recompute when a timeout expires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, channel, members, roles, channels, permissions, jumpToMessage, userId, clock])

  return <ChatContext value={value}>{children}</ChatContext>
}
