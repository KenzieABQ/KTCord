"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import type { Channel } from "@/lib/api/channels"
import { dmTitle, type DmChannel } from "@/lib/api/dms"
import type { Member, Role } from "@/lib/api/members"
import type { MentionSources } from "@/lib/mentions"
import { memberDisplayName } from "@/lib/members"
import { isTimedOut } from "@/lib/moderation"
import { hasPermission, Permission } from "@/lib/permissions"
import { useChannelPermissions } from "@/lib/queries/channel-permissions"
import { useChannels, useMembers, useRoles } from "@/lib/queries/servers"
import { useUserId } from "@/lib/stores/auth-store"

export type ChatContextValue = {
  /** null in DMs. */
  serverId: string | null
  /** "/channels/<serverId>" or "/channels/me", for links to channels and messages. */
  basePath: string
  channel: Channel
  /** "#general", "@Ava" or a group DM's name: for the composer placeholder and the welcome header. */
  channelLabel: string
  membersById: Map<string, Member>
  rolesById: Map<string, Role>
  channelsById: Map<string, Channel>
  permissions: number
  canSend: boolean
  /** Set while the signed-in member is timed out (they can read but not post). */
  timedOutUntil: string | null
  canManageMessages: boolean
  canMentionEveryone: boolean
  canAddReactions: boolean
  canAttach: boolean
  canPin: boolean
  /** Threads can be started from messages in server text channels (not inside threads or DMs). */
  canStartThreads: boolean
  /** Names for converting readable mentions to tokens and back. */
  mentionSources: MentionSources
  /** Scrolls the feed to a message, loading older history if needed. */
  jumpToMessage: (id: string) => void
  /** Seconds members must wait between messages here (0 = off). */
  slowmodeSeconds: number
  canBypassSlowmode: boolean
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function useChat(): ChatContextValue {
  const value = useContext(ChatContext)
  if (!value) throw new Error("useChat() must be used inside a chat provider")
  return value
}

/** The chat context when inside a channel or DM, or null elsewhere (e.g. settings). */
export function useOptionalChat(): ChatContextValue | null {
  return useContext(ChatContext)
}

function mentionUsers(members: Iterable<Member>) {
  return [...members].map((m) => ({ id: m.user_id, username: m.profile.username, name: memberDisplayName(m) }))
}

/** Lookup tables and permissions for a server channel. */
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
  // Server permissions with this channel's overrides applied (threads follow their parent).
  const { permissions } = useChannelPermissions(serverId, channel.id)
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
      basePath: `/channels/${serverId}`,
      channel,
      channelLabel: `#${channel.name}`,
      membersById: new Map((members ?? []).map((m) => [m.user_id, m])),
      rolesById: new Map((roles ?? []).map((r) => [r.id, r])),
      channelsById: new Map((channels ?? []).map((c) => [c.id, c])),
      permissions,
      canSend: hasPermission(permissions, Permission.SEND_MESSAGES) && !timedOutUntil,
      timedOutUntil,
      canManageMessages: hasPermission(permissions, Permission.MANAGE_MESSAGES),
      canMentionEveryone: hasPermission(permissions, Permission.MENTION_EVERYONE),
      canAddReactions: hasPermission(permissions, Permission.ADD_REACTIONS) && !timedOutUntil,
      canAttach: hasPermission(permissions, Permission.ATTACH_FILES | Permission.SEND_MESSAGES) && !timedOutUntil,
      canPin: hasPermission(permissions, Permission.MANAGE_MESSAGES),
      canStartThreads:
        channel.type === "text" && hasPermission(permissions, Permission.SEND_MESSAGES) && !timedOutUntil,
      slowmodeSeconds: channel.slowmode_seconds ?? 0,
      canBypassSlowmode:
        hasPermission(permissions, Permission.MANAGE_MESSAGES) || hasPermission(permissions, Permission.MANAGE_CHANNELS),
      mentionSources: {
        users: mentionUsers(members ?? []),
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

const DM_PERMISSIONS =
  Permission.VIEW_CHANNEL | Permission.SEND_MESSAGES | Permission.ATTACH_FILES | Permission.ADD_REACTIONS

/** The same context for a DM or group DM: recipients stand in for members; no roles or moderation. */
export function DmChatProvider({
  dm,
  jumpToMessage,
  children,
}: {
  dm: DmChannel
  jumpToMessage: (id: string) => void
  children: ReactNode
}) {
  const userId = useUserId()

  const value = useMemo<ChatContextValue>(() => {
    const members: Member[] = dm.recipients.map((r) => ({
      id: `${dm.id}:${r.user_id}`,
      server_id: "",
      user_id: r.user_id,
      nickname: null,
      joined_at: r.joined_at,
      timeout_until: null,
      profile: r.profile,
      role_ids: [],
    }))
    const label =
      dm.type === "dm" ? `@${dmTitle(dm, userId)}` : dmTitle(dm, userId)
    return {
      serverId: null,
      basePath: "/channels/me",
      channel: dm,
      channelLabel: label,
      membersById: new Map(members.map((m) => [m.user_id, m])),
      rolesById: new Map(),
      channelsById: new Map(),
      permissions: DM_PERMISSIONS,
      canSend: dm.recipients.some((r) => r.user_id === userId),
      timedOutUntil: null,
      canManageMessages: false,
      canMentionEveryone: false,
      canAddReactions: true,
      canAttach: true,
      canPin: true,
      canStartThreads: false,
      slowmodeSeconds: 0,
      canBypassSlowmode: true,
      mentionSources: { users: mentionUsers(members), roles: [], channels: [] },
      jumpToMessage,
    }
  }, [dm, userId, jumpToMessage])

  return <ChatContext value={value}>{children}</ChatContext>
}
