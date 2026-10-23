import type { QueryClient } from "@tanstack/react-query"

import type { Channel } from "@/lib/api/channels"
import type { Member } from "@/lib/api/members"
import type { DmChannel } from "@/lib/api/dms"
import { getProfile, type Profile } from "@/lib/api/profiles"
import type { NotificationSetting, UserSettings } from "@/lib/api/settings"
import type { JoinedServer, Server } from "@/lib/api/servers"
import { toChatMessage, type ChatMessage, type MessagePage } from "@/lib/messages/types"
import { patchInPages, removeFromPages, upsertIntoPages } from "@/lib/messages/feed"
import { indexPrefs, shouldNotify } from "@/lib/notifications"
import { qk } from "@/lib/queries/keys"
import { useTypingStore } from "@/lib/stores/typing-store"
import { useUnreadStore } from "@/lib/stores/unread-store"
import type { Tables } from "@/lib/supabase/database.types"

/**
 * Pure handlers for Postgres Changes events. Each one patches the TanStack Query cache.
 * INSERT/UPDATE payloads are full rows (already filtered by RLS). DELETE payloads carry
 * only the primary key, so deletes are matched against whatever the cache holds.
 */

type Change<T> =
  | { eventType: "INSERT"; new: T; old: Partial<T> }
  | { eventType: "UPDATE"; new: T; old: Partial<T> }
  | { eventType: "DELETE"; new: Partial<T>; old: Partial<T> & { id?: string } }

export type DbContext = {
  queryClient: QueryClient
  userId: string
  /** Called when the user loses access to a server (kicked, banned, server deleted). */
  onServerLost: (server: Pick<Server, "id" | "name">) => void
  /** Called for an incoming message that should pop a notification. */
  onNotify: (message: ChatMessage, where: { serverId: string | null; isDm: boolean }) => void
}

function servers(ctx: DbContext) {
  return ctx.queryClient.getQueryData<JoinedServer[]>(qk.servers(ctx.userId)) ?? []
}

function forgetServer(ctx: DbContext, serverId: string) {
  const lost = servers(ctx).find((s) => s.id === serverId)
  ctx.queryClient.setQueryData<JoinedServer[]>(qk.servers(ctx.userId), (list) =>
    list?.filter((s) => s.id !== serverId)
  )
  for (const key of [qk.channels, qk.members, qk.roles, qk.invites]) {
    ctx.queryClient.removeQueries({ queryKey: key(serverId) })
  }
  if (lost) ctx.onServerLost(lost)
}

/** Cache entries of one kind (e.g. every ["members", serverId] list) with their server ids. */
function entries<T>(ctx: DbContext, root: string) {
  return ctx.queryClient
    .getQueriesData<T[]>({ queryKey: [root] })
    .filter((entry): entry is [readonly unknown[], T[]] => Array.isArray(entry[1]))
}

export function onServerChange(ctx: DbContext, change: Change<Server>) {
  if (change.eventType === "UPDATE") {
    ctx.queryClient.setQueryData<JoinedServer[]>(qk.servers(ctx.userId), (list) =>
      list?.map((s) => (s.id === change.new.id ? { ...s, ...change.new } : s))
    )
  } else if (change.eventType === "DELETE" && change.old.id) {
    forgetServer(ctx, change.old.id)
  }
}

export function onMemberChange(ctx: DbContext, change: Change<Tables<"server_members">>) {
  if (change.eventType === "DELETE") {
    const id = change.old.id
    const mine = servers(ctx).find((s) => s.membership_id === id)
    if (mine) {
      forgetServer(ctx, mine.id)
      return
    }
    for (const [key, list] of entries<Member>(ctx, "members")) {
      if (list.some((m) => m.id === id)) {
        ctx.queryClient.setQueryData<Member[]>(key, list.filter((m) => m.id !== id))
      }
    }
    return
  }

  const row = change.new
  if (change.eventType === "INSERT" && row.user_id === ctx.userId) {
    // Joined a server (possibly from another device).
    void ctx.queryClient.invalidateQueries({ queryKey: qk.servers(ctx.userId) })
    void ctx.queryClient.invalidateQueries({ queryKey: qk.unreadState(ctx.userId) })
  }
  // New members need their profile and roles, so refetch rather than patch.
  void ctx.queryClient.invalidateQueries({ queryKey: qk.members(row.server_id) })
}

export function onRoleChange(ctx: DbContext, change: Change<Tables<"roles">>) {
  const serverId =
    change.eventType === "DELETE"
      ? entries<Tables<"roles">>(ctx, "roles").find(([, list]) =>
          list.some((r) => r.id === change.old.id)
        )?.[1][0]?.server_id
      : change.new.server_id
  if (!serverId) return
  void ctx.queryClient.invalidateQueries({ queryKey: qk.roles(serverId) })
  void ctx.queryClient.invalidateQueries({ queryKey: qk.members(serverId) })
  // Role changes can reveal or hide private channels.
  void ctx.queryClient.invalidateQueries({ queryKey: qk.channels(serverId) })
}

export function onMemberRoleChange(ctx: DbContext, change: Change<Tables<"member_roles">>) {
  if (change.eventType === "DELETE") {
    // Only the row id is known; refetch what's on screen.
    void ctx.queryClient.invalidateQueries({ queryKey: ["members"] })
    void ctx.queryClient.invalidateQueries({ queryKey: ["channels"] })
    return
  }
  void ctx.queryClient.invalidateQueries({ queryKey: qk.members(change.new.server_id) })
  if (change.new.user_id === ctx.userId) {
    void ctx.queryClient.invalidateQueries({ queryKey: qk.channels(change.new.server_id) })
  }
}

export function onChannelChange(ctx: DbContext, change: Change<Channel>) {
  if (change.eventType === "DELETE") {
    const id = change.old.id
    for (const [key, list] of entries<Channel>(ctx, "channels")) {
      if (list.some((c) => c.id === id)) {
        ctx.queryClient.setQueryData<Channel[]>(
          key,
          list
            .filter((c) => c.id !== id)
            .map((c) => (c.parent_id === id ? { ...c, parent_id: null } : c))
        )
      }
    }
    return
  }
  const channel = change.new
  if (channel.type === "thread") {
    if (change.eventType === "INSERT" && channel.source_message_id && channel.parent_id) {
      const sourceId = channel.source_message_id
      updatePages(ctx, channel.parent_id, (pages) =>
        patchInPages(pages, sourceId, (m) => ({
          ...m,
          thread: m.thread ?? { id: channel.id, name: channel.name ?? "Thread", message_count: 0, last_message_at: null },
        }))
      )
    }
    if (channel.parent_id) void ctx.queryClient.invalidateQueries({ queryKey: qk.threads(channel.parent_id) })
    ctx.queryClient.setQueryData(qk.thread(channel.id), channel)
    return
  }
  if (!channel.server_id) {
    // DM/group DM changes (renames, new owner): refresh the DM list.
    void ctx.queryClient.invalidateQueries({ queryKey: qk.dms(ctx.userId) })
    return
  }
  if (!["text", "voice", "category"].includes(channel.type)) return
  ctx.queryClient.setQueryData<Channel[]>(qk.channels(channel.server_id), (list) => {
    if (!list) return list
    return list.some((c) => c.id === channel.id)
      ? list.map((c) => (c.id === channel.id ? channel : c))
      : [...list, channel]
  })
}

export function onChannelAccessChange(ctx: DbContext) {
  // Visibility of private channels changed; the server decides who sees what.
  void ctx.queryClient.invalidateQueries({ queryKey: ["channels"] })
}

export function onChannelOverwriteChange(ctx: DbContext) {
  // Overrides change what people can do in a channel, and whether they can see it at all.
  void ctx.queryClient.invalidateQueries({ queryKey: ["channel-overwrites"] })
  void ctx.queryClient.invalidateQueries({ queryKey: ["channels"] })
}

export function onProfileChange(ctx: DbContext, change: Change<Profile>) {
  if (change.eventType !== "UPDATE") return
  const profile = change.new
  ctx.queryClient.setQueryData<Profile>(qk.profile(profile.id), (old) =>
    old ? { ...old, ...profile } : old
  )
  for (const [key, list] of entries<Member>(ctx, "members")) {
    if (list.some((m) => m.user_id === profile.id)) {
      ctx.queryClient.setQueryData<Member[]>(
        key,
        list.map((m) =>
          m.user_id === profile.id ? { ...m, profile: { ...m.profile, ...profile } } : m
        )
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Messages and read state
// ---------------------------------------------------------------------------

type Pages = { pages: MessagePage[]; pageParams: unknown[] }

function updatePages(ctx: DbContext, channelId: string, fn: (pages: MessagePage[]) => MessagePage[]) {
  ctx.queryClient.setQueryData<Pages>(qk.messages(channelId), (data) =>
    data ? { ...data, pages: fn(data.pages) } : data
  )
}

/** A new message in a thread updates the "N Messages" chip on the message that started it. */
function bumpThreadSummary(ctx: DbContext, message: ChatMessage) {
  for (const [key, data] of ctx.queryClient.getQueriesData<Pages>({ queryKey: ["messages"] })) {
    const hit = data?.pages.some((p) => p.messages.some((m) => m.thread?.id === message.channel_id))
    if (!hit || !data) continue
    ctx.queryClient.setQueryData<Pages>(key, {
      ...data,
      pages: data.pages.map((p) => ({
        ...p,
        messages: p.messages.map((m) =>
          m.thread?.id === message.channel_id
            ? {
                ...m,
                thread: { ...m.thread, message_count: m.thread.message_count + 1, last_message_at: message.created_at },
              }
            : m
        ),
      })),
    })
  }
}

/** True when the channel is one of the user's DMs (or an unknown non-server channel). */
function isDmChannel(ctx: DbContext, channelId: string): boolean {
  if (ctx.queryClient.getQueryData<DmChannel[]>(qk.dms(ctx.userId))?.some((dm) => dm.id === channelId)) return true
  for (const [, list] of entries<Channel>(ctx, "channels")) {
    if (list.some((c) => c.id === channelId)) return false
  }
  const entry = useUnreadStore.getState().channels[channelId]
  return entry ? entry.serverId === null : false
}

/** The server a channel belongs to, from whatever the cache knows. */
function serverOfChannel(ctx: DbContext, channelId: string): string | null {
  for (const [, list] of entries<Channel>(ctx, "channels")) {
    const hit = list.find((c) => c.id === channelId)
    if (hit) return hit.server_id
  }
  return useUnreadStore.getState().channels[channelId]?.serverId ?? null
}

function mentionsUser(ctx: DbContext, message: ChatMessage, serverId: string | null): boolean {
  if (message.mentions.includes(ctx.userId) || message.mention_everyone) return true
  if (!serverId || message.mention_roles.length === 0) return false
  const me = ctx.queryClient
    .getQueryData<Member[]>(qk.members(serverId))
    ?.find((m) => m.user_id === ctx.userId)
  return Boolean(me?.role_ids.some((id) => message.mention_roles.includes(id)))
}

export function onMessageChange(ctx: DbContext, change: Change<Tables<"messages">>) {
  if (change.eventType === "DELETE") {
    const id = change.old.id
    if (!id) return
    for (const [key, data] of ctx.queryClient.getQueriesData<Pages>({ queryKey: ["messages"] })) {
      if (data?.pages.some((p) => p.messages.some((m) => m.id === id))) {
        ctx.queryClient.setQueryData<Pages>(key, { ...data, pages: removeFromPages(data.pages, id) })
      }
    }
    ctx.queryClient.removeQueries({ queryKey: qk.message(id) })
    return
  }

  const message = toChatMessage(change.new)
  updatePages(ctx, message.channel_id, (pages) => upsertIntoPages(pages, message))
  if (change.eventType === "UPDATE") {
    // UPDATE events carry no old row, so any edit may be a pin change. Only an open pins list refetches.
    void ctx.queryClient.invalidateQueries({ queryKey: qk.pins(message.channel_id), refetchType: "active" })
  }
  if (change.eventType === "INSERT") bumpThreadSummary(ctx, message)
  if (ctx.queryClient.getQueryData(qk.message(message.id)) !== undefined) {
    ctx.queryClient.setQueryData(qk.message(message.id), message)
  }

  if (change.eventType === "INSERT") {
    const isDm = isDmChannel(ctx, message.channel_id)
    const serverId = isDm ? null : serverOfChannel(ctx, message.channel_id)
    const mine = message.author_id === ctx.userId
    // Every DM message counts toward the DM's badge, like a mention.
    const mentionsMe = isDm || mentionsUser(ctx, message, serverId)
    if (message.author_id) useTypingStore.getState().stop(message.channel_id, message.author_id)
    const { active } = useUnreadStore.getState()
    const watching =
      active?.channelId === message.channel_id &&
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      document.hasFocus()
    useUnreadStore.getState().onMessage({
      channelId: message.channel_id,
      serverId,
      createdAt: message.created_at,
      mine,
      mentionsMe,
    })
    if (!mine && !watching) {
      const prefs = indexPrefs(ctx.queryClient.getQueryData<NotificationSetting[]>(qk.notificationSettings(ctx.userId)))
      const dnd = ctx.queryClient.getQueryData<UserSettings>(qk.mySettings(ctx.userId))?.status === "dnd"
      if (shouldNotify({ prefs, serverId, channelId: message.channel_id, mentionsMe, isDm, dnd })) {
        ctx.onNotify(message, { serverId, isDm })
      }
    }
    if (isDm) {
      // A new DM (or one reopened by this message) may not be in the list yet.
      const dms = ctx.queryClient.getQueryData<DmChannel[]>(qk.dms(ctx.userId))
      const known = dms?.find((dm) => dm.id === message.channel_id)
      if (!known || known.recipients.find((r) => r.user_id === ctx.userId)?.hidden) {
        void ctx.queryClient.invalidateQueries({ queryKey: qk.dms(ctx.userId) })
      } else {
        ctx.queryClient.setQueryData<DmChannel[]>(qk.dms(ctx.userId), (list) =>
          list
            ?.map((dm) => (dm.id === message.channel_id ? { ...dm, last_message_at: message.created_at } : dm))
            .sort((a, b) => (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at))
        )
      }
    }
    // Unknown authors (e.g. someone who just joined) are fetched for the feed.
    if (message.author_id && !ctx.queryClient.getQueryData(qk.profile(message.author_id))) {
      void ctx.queryClient.prefetchQuery({
        queryKey: qk.profile(message.author_id),
        queryFn: () => getProfile(message.author_id!),
      })
    }
  }
}

/** Another device of yours read a channel. */
export function onReadStateChange(ctx: DbContext, change: Change<Tables<"read_states">>) {
  if (change.eventType === "DELETE" || change.new.user_id !== ctx.userId) return
  useUnreadStore.getState().markRead(change.new.channel_id, change.new.last_read_at)
}

// ---------------------------------------------------------------------------
// Settings, friends and DMs (own rows only, per RLS)
// ---------------------------------------------------------------------------

export function onUserSettingsChange(ctx: DbContext, change: Change<Tables<"user_settings">>) {
  if (change.eventType === "DELETE" || change.new.user_id !== ctx.userId) return
  ctx.queryClient.setQueryData(qk.mySettings(ctx.userId), change.new)
}

export function onNotificationSettingsChange(ctx: DbContext) {
  void ctx.queryClient.invalidateQueries({ queryKey: qk.notificationSettings(ctx.userId) })
}

export function onFriendshipChange(ctx: DbContext) {
  void ctx.queryClient.invalidateQueries({ queryKey: qk.friendships(ctx.userId) })
}

export function onRecipientChange(ctx: DbContext) {
  void ctx.queryClient.invalidateQueries({ queryKey: qk.dms(ctx.userId) })
  void ctx.queryClient.invalidateQueries({ queryKey: qk.unreadState(ctx.userId) })
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

export function onReactionChange(ctx: DbContext, change: Change<Tables<"reactions">>) {
  if (change.eventType === "DELETE") {
    const id = change.old.id
    if (!id) return
    for (const [key, data] of ctx.queryClient.getQueriesData<Pages>({ queryKey: ["messages"] })) {
      if (!data?.pages.some((p) => p.messages.some((m) => m.reactions?.some((r) => r.id === id)))) continue
      ctx.queryClient.setQueryData<Pages>(key, {
        ...data,
        pages: data.pages.map((p) => ({
          ...p,
          messages: p.messages.map((m) =>
            m.reactions?.some((r) => r.id === id) ? { ...m, reactions: m.reactions.filter((r) => r.id !== id) } : m
          ),
        })),
      })
    }
    return
  }
  if (change.eventType !== "INSERT") return
  const row = change.new
  updatePages(ctx, row.channel_id, (pages) =>
    patchInPages(pages, row.message_id, (m) => {
      const others = (m.reactions ?? []).filter(
        // Replace our own optimistic copy (local id) with the real row.
        (r) => r.id !== row.id && !(r.user_id === row.user_id && r.emoji === row.emoji)
      )
      return { ...m, reactions: [...others, { id: row.id, user_id: row.user_id, emoji: row.emoji }] }
    })
  )
}
