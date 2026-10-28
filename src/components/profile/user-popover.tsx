"use client"

import { CheckIcon, MessageCircleIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useState, type ComponentProps, type ReactNode } from "react"
import { toast } from "@/lib/toast"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { errorMessage } from "@/lib/api/errors"
import type { Member, Role } from "@/lib/api/members"
import { hasPermission, Permission } from "@/lib/permissions"
import { activeCustomStatus } from "@/lib/custom-status"
import { memberDisplayName } from "@/lib/members"
import { displayNameOf } from "@/lib/profile-display"
import { useProfile } from "@/lib/queries/profiles"
import { useSetMemberRoles } from "@/lib/queries/moderation"
import { useMembers, useRoles, useServerPermissions } from "@/lib/queries/servers"
import { useOpenDm } from "@/lib/queries/social"
import { useUserId } from "@/lib/stores/auth-store"
import { useComposerStore } from "@/lib/stores/composer-store"
import { usePresenceStatus } from "@/lib/stores/presence-store"

import { ProfileCard, profileThemeFields } from "./profile-card"

/**
 * A member's roles in their profile card. With Manage Roles you can remove roles below
 * your highest one (×) and add more (+), as in Discord.
 */
function MemberRoles({ serverId, member, roles }: { serverId: string; member: Member; roles: Role[] }) {
  const { permissions, topPosition, isOwner } = useServerPermissions(serverId)
  const setRoles = useSetMemberRoles(serverId)
  const [query, setQuery] = useState("")
  const canManage = hasPermission(permissions, Permission.MANAGE_ROLES)
  const assignable = (role: Role) => canManage && !role.is_default && (isOwner || role.position < topPosition)
  const has = roles.filter((r) => !r.is_default && member.role_ids.includes(r.id)).sort((a, b) => b.position - a.position)
  const addable = roles
    .filter((r) => assignable(r) && r.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.position - a.position)
  if (has.length === 0 && !canManage) return null

  const toggle = (role: Role) => {
    const next = member.role_ids.includes(role.id)
      ? member.role_ids.filter((id) => id !== role.id)
      : [...member.role_ids, role.id]
    setRoles.mutate({ userId: member.user_id, roleIds: next }, { onError: (e) => toast.error(errorMessage(e)) })
  }

  return (
    <section>
      <h3 className="text-xs font-bold tracking-wide text-header uppercase">{has.length === 1 ? "Role" : "Roles"}</h3>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {has.map((role) => (
          <span
            key={role.id}
            className="group/role flex items-center gap-1 rounded-sm bg-sidebar px-1.5 py-0.5 text-xs text-foreground"
          >
            {assignable(role) ? (
              <button
                type="button"
                aria-label={`Remove ${role.name}`}
                onClick={() => toggle(role)}
                className="relative flex size-2.5 items-center justify-center rounded-full"
                style={{ backgroundColor: role.color ?? "#99aab5" }}
              >
                <XIcon className="hidden size-2.5 text-black group-hover/role:block" strokeWidth={3} />
              </button>
            ) : (
              <span className="size-2.5 rounded-full" style={{ backgroundColor: role.color ?? "#99aab5" }} />
            )}
            {role.name}
          </span>
        ))}
        {canManage && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Add role"
                className="flex size-[22px] items-center justify-center rounded-sm bg-sidebar text-interactive hover:text-interactive-hover"
              >
                <PlusIcon className="size-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className="w-56 border-border bg-floating p-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Role"
                aria-label="Search roles"
                autoFocus
                className="mb-1.5 h-8 w-full rounded-md bg-input px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <ul className="max-h-56 overflow-y-auto">
                {addable.length === 0 && <li className="px-2 py-1.5 text-sm text-muted-foreground">No roles</li>}
                {addable.map((role) => {
                  const on = member.role_ids.includes(role.id)
                  return (
                    <li key={role.id}>
                      <button
                        type="button"
                        onClick={() => toggle(role)}
                        className="flex min-h-8 w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm font-medium text-foreground hover:bg-item-hover"
                      >
                        <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: role.color ?? "#99aab5" }} />
                        <span className="min-w-0 flex-1 truncate">{role.name}</span>
                        {on && <CheckIcon className="size-4 text-primary" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </section>
  )
}

function PopoverBody({ userId, serverId, onDone }: { userId: string; serverId: string | null; onDone: () => void }) {
  const selfId = useUserId()
  const { data: members } = useMembers(serverId ?? undefined)
  const { data: roles } = useRoles(serverId ?? undefined)
  const member = members?.find((m) => m.user_id === userId)
  const { data: fullProfile } = useProfile(userId)
  const status = usePresenceStatus(userId)
  const openDm = useOpenDm()
  const [message, setMessage] = useState("")

  const profile = fullProfile ?? member?.profile
  if (!profile) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-14 w-full bg-item-selected/60" />
        <Skeleton className="size-16 rounded-full bg-item-selected/60" />
        <Skeleton className="h-4 w-32 bg-item-selected/60" />
      </div>
    )
  }

  const custom = activeCustomStatus(profile)
  const isSelf = userId === selfId

  async function send() {
    try {
      const channelId = await openDm.mutateAsync(userId)
      // Hand what they typed to the DM's composer.
      if (message.trim()) useComposerStore.getState().setDraft(channelId, message.trim())
      onDone()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <ProfileCard
      className="rounded-none shadow-none"
      status={status}
      profile={{
        id: profile.id,
        username: profile.username,
        displayName: member ? memberDisplayName(member) : displayNameOf(profile),
        avatarUrl: profile.avatar_url,
        bannerColor: profile.banner_color,
        ...profileThemeFields(profile),
        bio: profile.bio,
        createdAt: profile.created_at,
        customStatus: custom ? [custom.emoji, custom.text].filter(Boolean).join(" ") : null,
      }}
    >
      {member && serverId && <MemberRoles serverId={serverId} member={member} roles={roles ?? []} />}
      {isSelf ? (
        <Button asChild variant="secondary" className="w-full">
          <Link href="/settings/profile" onClick={onDone}>
            <PencilIcon /> Edit Profile
          </Link>
        </Button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
          className="flex gap-1.5"
        >
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Message @${profile.username}`}
            aria-label={`Message @${profile.username}`}
            className="h-9 min-w-0 flex-1 rounded-md bg-input px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" size="icon-lg" aria-label="Send Message" disabled={openDm.isPending}>
            <MessageCircleIcon />
          </Button>
        </form>
      )}
    </ProfileCard>
  )
}

/** Click a name or avatar to see someone's profile card: roles, bio, and a way to message them. */
export function UserPopover({
  userId,
  serverId = null,
  side = "right",
  children,
  ...triggerProps
}: {
  userId: string | null
  serverId?: string | null
  side?: "left" | "right" | "top" | "bottom"
  children: ReactNode
} & Omit<ComponentProps<typeof PopoverTrigger>, "children" | "asChild">) {
  const [open, setOpen] = useState(false)
  if (!userId) return children
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Extra props (e.g. from a wrapping ContextMenuTrigger) land on the trigger element. */}
      <PopoverTrigger asChild {...triggerProps}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="w-[300px] overflow-hidden border-0 bg-card p-0 shadow-2xl"
      >
        {open && <PopoverBody userId={userId} serverId={serverId} onDone={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  )
}
