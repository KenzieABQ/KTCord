import type { NotificationLevel, NotificationSetting } from "@/lib/api/settings"

export type NotificationPrefs = {
  servers: Map<string, NotificationSetting>
  channels: Map<string, NotificationSetting>
}

export const DEFAULT_LEVEL: NotificationLevel = "mentions"

export function indexPrefs(rows: NotificationSetting[] | undefined): NotificationPrefs {
  const prefs: NotificationPrefs = { servers: new Map(), channels: new Map() }
  for (const row of rows ?? []) {
    if (row.server_id) prefs.servers.set(row.server_id, row)
    if (row.channel_id) prefs.channels.set(row.channel_id, row)
  }
  return prefs
}

/** muted_until is a timestamp, "infinity" (until turned back on), or null. */
export function isMutedSetting(setting: NotificationSetting | undefined, now = new Date()): boolean {
  const until = setting?.muted_until
  if (!until) return false
  if (until === "infinity") return true
  return new Date(until) > now
}

export function isServerMuted(prefs: NotificationPrefs, serverId: string | null, now = new Date()) {
  return Boolean(serverId) && isMutedSetting(prefs.servers.get(serverId!), now)
}

export function isChannelMuted(prefs: NotificationPrefs, channelId: string, now = new Date()) {
  return isMutedSetting(prefs.channels.get(channelId), now)
}

/** Channel level, else server level, else "mentions". */
export function effectiveLevel(
  prefs: NotificationPrefs,
  serverId: string | null,
  channelId: string
): NotificationLevel {
  return (
    prefs.channels.get(channelId)?.level ??
    (serverId ? prefs.servers.get(serverId)?.level : null) ??
    DEFAULT_LEVEL
  )
}

/**
 * Whether an incoming message should pop a toast. Do Not Disturb silences everything;
 * muted servers/channels stay quiet; DMs always notify unless muted.
 */
export function shouldNotify(input: {
  prefs: NotificationPrefs
  serverId: string | null
  channelId: string
  mentionsMe: boolean
  isDm: boolean
  dnd: boolean
  now?: Date
}): boolean {
  const { prefs, serverId, channelId, mentionsMe, isDm, dnd, now = new Date() } = input
  if (dnd) return false
  if (isChannelMuted(prefs, channelId, now) || isServerMuted(prefs, serverId, now)) return false
  if (isDm) return true
  const level = effectiveLevel(prefs, serverId, channelId)
  if (level === "nothing") return false
  if (level === "all") return true
  return mentionsMe
}

export const MUTE_DURATIONS = [
  { label: "For 15 Minutes", minutes: 15 },
  { label: "For 1 Hour", minutes: 60 },
  { label: "For 8 Hours", minutes: 8 * 60 },
  { label: "For 24 Hours", minutes: 24 * 60 },
  { label: "Until I turn it back on", minutes: null },
] as const
