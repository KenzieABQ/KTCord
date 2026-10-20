"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"

import type { Channel } from "@/lib/api/channels"
import type { Member, Role } from "@/lib/api/members"
import { hasPermission, Permission } from "@/lib/permissions"
import { useChannels, useMembers, useRoles, useServerPermissions } from "@/lib/queries/servers"

export type ChatContextValue = {
  serverId: string
  channel: Channel
  membersById: Map<string, Member>
  rolesById: Map<string, Role>
  channelsById: Map<string, Channel>
  permissions: number
  canSend: boolean
  canManageMessages: boolean
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

  const value = useMemo<ChatContextValue>(
    () => ({
      serverId,
      channel,
      membersById: new Map((members ?? []).map((m) => [m.user_id, m])),
      rolesById: new Map((roles ?? []).map((r) => [r.id, r])),
      channelsById: new Map((channels ?? []).map((c) => [c.id, c])),
      permissions,
      canSend: hasPermission(permissions, Permission.SEND_MESSAGES),
      canManageMessages: hasPermission(permissions, Permission.MANAGE_MESSAGES),
      jumpToMessage,
    }),
    [serverId, channel, members, roles, channels, permissions, jumpToMessage]
  )

  return <ChatContext value={value}>{children}</ChatContext>
}
