"use client"

import { Command as CommandPrimitive } from "cmdk"
import { CheckIcon, PlusIcon, SlashIcon, UserIcon, XIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "@/lib/toast"

import { UserAvatar } from "@/components/profile/user-avatar"
import { PrivateChannelFields, type AccessValue } from "@/components/servers/channel-dialogs"
import { SettingsSection, UnsavedChangesBar } from "@/components/settings/settings-layout"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Channel } from "@/lib/api/channels"
import { errorMessage } from "@/lib/api/errors"
import { memberDisplayName } from "@/lib/members"
import { PERMISSION_GROUPS } from "@/lib/permission-labels"
import { hasPermission, Permission, type PermissionName } from "@/lib/permissions"
import { useChannelOverwrites, useSetChannelOverwrite } from "@/lib/queries/channel-permissions"
import { useChannelAccess, useSetChannelAccess } from "@/lib/queries/moderation"
import { useChannel, useMembers, useRoles, useServerPermissions } from "@/lib/queries/servers"
import { cn } from "@/lib/utils"

import { useChannelSettingsParams } from "./channel-settings-shell"

type Bits = { allow: number; deny: number }
type Target = { key: string; roleId?: string; userId?: string; name: string; color?: string | null; avatarUrl?: string | null; locked: boolean }

const LABELS = new Map(PERMISSION_GROUPS.flatMap((g) => g.permissions).map((p) => [p.key, p]))

const GROUPS: Record<"text" | "voice", { heading: string; keys: PermissionName[] }[]> = {
  text: [
    { heading: "General Channel Permissions", keys: ["VIEW_CHANNEL"] },
    { heading: "Text Channel Permissions", keys: ["SEND_MESSAGES", "ATTACH_FILES", "ADD_REACTIONS", "MANAGE_MESSAGES"] },
  ],
  voice: [
    { heading: "General Channel Permissions", keys: ["VIEW_CHANNEL"] },
    { heading: "Voice Channel Permissions", keys: ["CONNECT", "SPEAK", "VIDEO"] },
  ],
}

const sameBits = (a: Bits | undefined, b: Bits | undefined) => (a?.allow ?? 0) === (b?.allow ?? 0) && (a?.deny ?? 0) === (b?.deny ?? 0)

/** Discord's ✗ / ⁄ / ✓ switch: deny, inherit from roles and server settings, or allow. */
function TriState({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: "deny" | "inherit" | "allow"
  disabled: boolean
  onChange: (value: "deny" | "inherit" | "allow") => void
}) {
  const options = [
    { value: "deny" as const, icon: XIcon, title: "Deny", on: "bg-destructive text-white" },
    { value: "inherit" as const, icon: SlashIcon, title: "Inherit", on: "bg-item-selected text-header" },
    { value: "allow" as const, icon: CheckIcon, title: "Allow", on: "bg-success text-white" },
  ]
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0 overflow-hidden rounded-md border border-border">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          aria-label={o.title}
          title={o.title}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex size-8 items-center justify-center text-muted-foreground transition-colors hover:bg-item-hover disabled:cursor-not-allowed disabled:opacity-50",
            value === o.value && o.on
          )}
        >
          <o.icon className="size-4" />
        </button>
      ))}
    </div>
  )
}

function PermissionsEditor({ serverId, channel }: { serverId: string; channel: Channel }) {
  const { data: roles } = useRoles(serverId)
  const { data: members } = useMembers(serverId)
  const { data: overwrites } = useChannelOverwrites(serverId)
  const { topPosition, isOwner } = useServerPermissions(serverId)
  const access = useChannelAccess(channel.id, channel.is_private)
  const setAccess = useSetChannelAccess(serverId)
  const setOverwrite = useSetChannelOverwrite(serverId)

  const everyone = roles?.find((r) => r.is_default)
  const saved = useMemo(() => {
    const map: Record<string, Bits> = {}
    for (const o of overwrites ?? []) {
      if (o.channel_id !== channel.id) continue
      map[o.role_id ? `role:${o.role_id}` : `user:${o.user_id}`] = { allow: o.allow, deny: o.deny }
    }
    return map
  }, [overwrites, channel.id])

  // null = no edits; otherwise the full edited set of overrides.
  const [draft, setDraft] = useState<Record<string, Bits> | null>(null)
  const [accessDraft, setAccessDraft] = useState<AccessValue | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const current = draft ?? saved

  const targetFor = (key: string): Target | null => {
    const [kind, id] = key.split(":")
    if (kind === "role") {
      const role = roles?.find((r) => r.id === id)
      if (!role) return null
      return {
        key,
        roleId: id,
        name: role.is_default ? "@everyone" : role.name,
        color: role.color,
        locked: !role.is_default && !isOwner && role.position >= topPosition,
      }
    }
    const member = members?.find((m) => m.user_id === id)
    if (!member) return null
    return { key, userId: id, name: memberDisplayName(member), avatarUrl: member.profile.avatar_url, locked: false }
  }

  const everyoneKey = everyone ? `role:${everyone.id}` : null
  const keys = [
    ...(everyoneKey ? [everyoneKey] : []),
    ...Object.keys(current)
      .filter((k) => k !== everyoneKey)
      .sort((a, b) => {
        // Roles (highest first), then members by name.
        const ra = roles?.find((r) => `role:${r.id}` === a)
        const rb = roles?.find((r) => `role:${r.id}` === b)
        if (ra && rb) return rb.position - ra.position
        if (ra) return -1
        if (rb) return 1
        return (targetFor(a)?.name ?? "").localeCompare(targetFor(b)?.name ?? "")
      }),
  ]
  const targets = keys.map(targetFor).filter((t): t is Target => t !== null)
  const active = targets.find((t) => t.key === (selected ?? everyoneKey)) ?? targets[0]
  const activeBits = active ? (current[active.key] ?? { allow: 0, deny: 0 }) : { allow: 0, deny: 0 }

  const accessValue: AccessValue = accessDraft ?? { isPrivate: channel.is_private, roleIds: access.data ?? [] }
  const changedKeys = [...new Set([...Object.keys(saved), ...Object.keys(current)])].filter((k) => !sameBits(saved[k], current[k]))
  const dirty = changedKeys.length > 0 || accessDraft !== null

  function setBit(bit: number, value: "deny" | "inherit" | "allow") {
    if (!active) return
    const bits = current[active.key] ?? { allow: 0, deny: 0 }
    const next = { allow: bits.allow & ~bit, deny: bits.deny & ~bit }
    if (value === "allow") next.allow |= bit
    if (value === "deny") next.deny |= bit
    setDraft({ ...current, [active.key]: next })
  }

  function addTarget(key: string) {
    if (!current[key]) setDraft({ ...current, [key]: { allow: 0, deny: 0 } })
    setSelected(key)
    setAdding(false)
  }

  function removeTarget(key: string) {
    const next = { ...current }
    delete next[key]
    setDraft(next)
    setSelected(null)
  }

  function reset() {
    setDraft(null)
    setAccessDraft(null)
  }

  async function save() {
    setSaving(true)
    try {
      if (accessDraft) {
        await setAccess.mutateAsync({ channelId: channel.id, isPrivate: accessDraft.isPrivate, roleIds: accessDraft.roleIds })
      }
      for (const key of changedKeys) {
        const [kind, id] = key.split(":")
        const bits = current[key] ?? { allow: 0, deny: 0 }
        await setOverwrite.mutateAsync({
          channelId: channel.id,
          roleId: kind === "role" ? id : null,
          userId: kind === "user" ? id : null,
          allow: bits.allow,
          deny: bits.deny,
        })
      }
      toast.success("Permissions saved.")
      reset()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const addableRoles = (roles ?? []).filter((r) => !r.is_default && !current[`role:${r.id}`])
  const addableMembers = (members ?? []).filter((m) => !current[`user:${m.user_id}`])
  const groups = GROUPS[channel.type === "voice" ? "voice" : "text"]

  return (
    <>
      <SettingsSection
        title="Permissions"
        description="Use permissions to customize who can do what in this channel. Overrides here beat the server-wide role settings."
      >
        <PrivateChannelFields
          serverId={serverId}
          value={accessValue}
          loading={channel.is_private && access.isPending}
          onChange={setAccessDraft}
        />
      </SettingsSection>

      <SettingsSection title="Advanced Permissions">
        <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Roles/Members</span>
              <Popover open={adding} onOpenChange={setAdding}>
                <PopoverTrigger
                  aria-label="Add a role or member"
                  className="flex size-6 items-center justify-center rounded-md text-interactive hover:bg-item-hover hover:text-interactive-hover"
                >
                  <PlusIcon className="size-4" />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 bg-floating p-0">
                  <CommandPrimitive label="Add a role or member">
                    <CommandPrimitive.Input
                      autoFocus
                      placeholder="Search roles and members"
                      className="h-10 w-full border-b border-border bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    <CommandPrimitive.List className="max-h-64 overflow-y-auto p-1">
                      <CommandPrimitive.Empty className="p-3 text-center text-sm text-muted-foreground">Nothing to add.</CommandPrimitive.Empty>
                      {addableRoles.length > 0 && (
                        <CommandPrimitive.Group heading="Roles" className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-bold **:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:uppercase">
                          {addableRoles.map((r) => (
                            <CommandPrimitive.Item
                              key={r.id}
                              value={`role ${r.name} ${r.id}`}
                              onSelect={() => addTarget(`role:${r.id}`)}
                              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-interactive data-[selected=true]:bg-item-hover data-[selected=true]:text-interactive-hover"
                            >
                              <span className="size-3 rounded-full" style={{ backgroundColor: r.color ?? "#99aab5" }} />
                              {r.name}
                            </CommandPrimitive.Item>
                          ))}
                        </CommandPrimitive.Group>
                      )}
                      {addableMembers.length > 0 && (
                        <CommandPrimitive.Group heading="Members" className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-bold **:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:uppercase">
                          {addableMembers.map((m) => (
                            <CommandPrimitive.Item
                              key={m.user_id}
                              value={`member ${memberDisplayName(m)} ${m.profile.username} ${m.user_id}`}
                              onSelect={() => addTarget(`user:${m.user_id}`)}
                              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-interactive data-[selected=true]:bg-item-hover data-[selected=true]:text-interactive-hover"
                            >
                              <UserAvatar userId={m.user_id} name={memberDisplayName(m)} src={m.profile.avatar_url} className="size-5" />
                              <span className="truncate">{memberDisplayName(m)}</span>
                            </CommandPrimitive.Item>
                          ))}
                        </CommandPrimitive.Group>
                      )}
                    </CommandPrimitive.List>
                  </CommandPrimitive>
                </PopoverContent>
              </Popover>
            </div>
            <ul aria-label="Roles and members with overrides" className="flex flex-col gap-0.5">
              {targets.map((t) => (
                <li key={t.key}>
                  <button
                    type="button"
                    aria-current={active?.key === t.key ? "true" : undefined}
                    onClick={() => setSelected(t.key)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                      active?.key === t.key ? "bg-item-selected text-interactive-active" : "text-interactive hover:bg-item-hover"
                    )}
                  >
                    {t.userId ? (
                      <UserAvatar userId={t.userId} name={t.name} src={t.avatarUrl} className="size-5" />
                    ) : (
                      <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: t.color ?? "#99aab5" }} />
                    )}
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    {t.userId && <UserIcon aria-label="Member" className="size-3.5 shrink-0 text-muted-foreground" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {active && (
            <div className="min-w-0 rounded-lg bg-sidebar p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="truncate font-semibold text-header">{active.name}</h3>
                {active.key !== everyoneKey && !active.locked && (
                  <button
                    type="button"
                    onClick={() => removeTarget(active.key)}
                    className="shrink-0 text-sm text-destructive hover:underline"
                  >
                    Remove override
                  </button>
                )}
              </div>
              {active.locked && (
                <p className="mb-3 rounded-md bg-status-idle/15 px-3 py-2 text-sm text-header">
                  This role is at or above your highest role, so you can&apos;t change its overrides.
                </p>
              )}
              {groups.map((group) => (
                <section key={group.heading} className="mb-4 last:mb-0">
                  <h4 className="mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">{group.heading}</h4>
                  <ul className="divide-y divide-border">
                    {group.keys.map((key) => {
                      const bit = Permission[key]
                      const info = LABELS.get(key)
                      const value = hasPermission(activeBits.allow, bit) ? "allow" : hasPermission(activeBits.deny, bit) ? "deny" : "inherit"
                      return (
                        <li key={key} className="flex items-center justify-between gap-4 py-3">
                          <div className="min-w-0">
                            <p className="font-medium text-header">{info?.label ?? key}</p>
                            <p className="text-sm text-muted-foreground">{info?.description}</p>
                          </div>
                          <TriState
                            label={info?.label ?? key}
                            value={value}
                            disabled={active.locked}
                            onChange={(v) => setBit(bit, v)}
                          />
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        {dirty && <UnsavedChangesBar onReset={reset} onSave={() => void save()} saving={saving} />}
      </SettingsSection>
    </>
  )
}

/** Channel Settings → Permissions: private access and per-role/member overrides. */
export function ChannelPermissionSettings() {
  const { serverId, channelId } = useChannelSettingsParams()
  const { data: channel } = useChannel(serverId, channelId)
  const { permissions } = useServerPermissions(serverId)
  if (!channel) return null
  if (!hasPermission(permissions, Permission.MANAGE_ROLES)) {
    return (
      <SettingsSection title="Permissions">
        <p className="text-muted-foreground">You need the Manage Roles permission to change channel permissions.</p>
      </SettingsSection>
    )
  }
  return <PermissionsEditor key={channel.id} serverId={serverId} channel={channel} />
}
