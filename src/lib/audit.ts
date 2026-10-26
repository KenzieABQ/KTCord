import { PERMISSION_GROUPS } from "@/lib/permission-labels"
import { Permission, type PermissionName } from "@/lib/permissions"
import { formatSlowmode } from "@/lib/slowmode"

export type AuditLike = {
  action: string
  target_name: string | null
  details: unknown
  reason: string | null
}

/** Action filters for the audit log, as `action` prefixes. */
export const AUDIT_FILTERS: { value: string; label: string }[] = [
  { value: "server_update", label: "Update Server" },
  { value: "channel_", label: "Channels" },
  { value: "overwrite_", label: "Channel Permissions" },
  { value: "role_", label: "Roles" },
  { value: "member_role_update", label: "Member Roles" },
  { value: "member_kick", label: "Kick Member" },
  { value: "member_ban", label: "Ban Member" },
  { value: "member_unban", label: "Unban Member" },
  { value: "member_timeout", label: "Timeouts" },
  { value: "member_voice_update", label: "Voice Moderation" },
  { value: "member_disconnect", label: "Disconnect Member" },
  { value: "member_update", label: "Nicknames" },
  { value: "invite_", label: "Invites" },
  { value: "emoji_", label: "Emoji" },
  { value: "message_delete", label: "Delete Message" },
  { value: "automod_rule_", label: "AutoMod Rules" },
]

const VERBS: Record<string, string> = {
  server_update: "updated the server",
  channel_create: "created the channel",
  channel_update: "updated the channel",
  channel_delete: "deleted the channel",
  overwrite_create: "added permission overrides to",
  overwrite_update: "updated permission overrides on",
  overwrite_delete: "removed permission overrides from",
  role_create: "created the role",
  role_update: "updated the role",
  role_delete: "deleted the role",
  member_role_update: "updated roles for",
  member_kick: "kicked",
  member_ban: "banned",
  member_unban: "unbanned",
  member_timeout: "timed out",
  member_timeout_remove: "removed the timeout for",
  member_update: "changed the nickname of",
  member_voice_update: "changed voice moderation for",
  member_disconnect: "disconnected from voice",
  invite_create: "created the invite",
  invite_delete: "deleted the invite",
  emoji_create: "added the emoji",
  emoji_update: "renamed the emoji",
  emoji_delete: "removed the emoji",
  message_delete: "deleted a message from",
  automod_rule_create: "created the AutoMod rule",
  automod_rule_update: "updated the AutoMod rule",
  automod_rule_delete: "deleted the AutoMod rule",
}

const PERMISSION_LABELS = PERMISSION_GROUPS.flatMap((g) => g.permissions).map((p) => ({
  label: p.label,
  bit: Permission[p.key as PermissionName],
}))

function permissionNames(bits: number): string[] {
  return PERMISSION_LABELS.filter((p) => p.bit && (bits & p.bit) === p.bit).map((p) => p.label)
}

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  topic: "Topic",
  slowmode: "Slowmode",
  private: "Private",
  color: "Color",
  hoist: "Shown separately",
  mentionable: "Mentionable",
  nickname: "Nickname",
  icon: "Icon",
  mute: "Server mute",
  deaf: "Server deafen",
}

function show(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "none"
  if (field === "slowmode" && typeof value === "number") return formatSlowmode(value)
  if (field === "icon" && typeof value === "boolean") return value ? "set" : "none"
  if (typeof value === "boolean") return value ? "on" : "off"
  return String(value)
}

/**
 * A readable version of an audit entry: the verb (after the actor's name), the target, and
 * one line per detail ("Name: general → chat", "Added: Send Messages").
 */
export function describeAudit(entry: AuditLike): { verb: string; target: string | null; lines: string[] } {
  const details = (entry.details && typeof entry.details === "object" ? entry.details : {}) as Record<string, unknown>
  const lines: string[] = []

  for (const [field, value] of Object.entries(details)) {
    if (Array.isArray(value) && value.length === 2) {
      const [before, after] = value
      if (field === "permissions" && typeof before === "number" && typeof after === "number") {
        const added = permissionNames(after & ~before)
        const removed = permissionNames(before & ~after)
        if (added.length) lines.push(`Allowed: ${added.join(", ")}`)
        if (removed.length) lines.push(`Took away: ${removed.join(", ")}`)
        continue
      }
      if (before === after) continue
      lines.push(`${FIELD_LABELS[field] ?? field}: ${show(field, before)} → ${show(field, after)}`)
    }
  }
  if (typeof details.added === "string") lines.push(`Added role: ${details.added}`)
  if (typeof details.removed === "string") lines.push(`Removed role: ${details.removed}`)
  if (typeof details.for === "string") lines.push(`For: ${details.for}`)
  if (typeof details.allow === "number" && details.allow) lines.push(`Allowed: ${permissionNames(details.allow).join(", ")}`)
  if (typeof details.deny === "number" && details.deny) lines.push(`Denied: ${permissionNames(details.deny).join(", ")}`)
  if (typeof details.until === "string") lines.push(`Until: ${new Date(details.until).toLocaleString()}`)
  if (typeof details.channel === "string") lines.push(`In: #${details.channel}`)
  if (typeof details.type === "string") lines.push(`Type: ${details.type}`)
  if (typeof details.max_uses === "number") lines.push(`Max uses: ${details.max_uses || "no limit"}`)
  if (entry.reason) lines.push(`Reason: ${entry.reason}`)

  const verb = VERBS[entry.action] ?? entry.action.replace(/_/g, " ")
  const target = entry.action === "server_update" ? null : entry.target_name
  return { verb, target, lines }
}
