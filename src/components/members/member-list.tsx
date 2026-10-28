"use client"

import { ClockIcon, CrownIcon } from "@/components/icons"
import { useMemo } from "react"

import { MemberListSkeleton } from "@/components/layout/skeletons"
import { UserAvatar } from "@/components/profile/user-avatar"
import { UserPopover } from "@/components/profile/user-popover"
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Member, Role } from "@/lib/api/members"
import { activeCustomStatus } from "@/lib/custom-status"
import { memberColor, memberDisplayName, memberHoistRole } from "@/lib/members"
import { isTimedOut } from "@/lib/moderation"
import { useMembers, useRoles, useServer } from "@/lib/queries/servers"
import { usePresenceStore, type LiveStatus } from "@/lib/stores/presence-store"
import { cn } from "@/lib/utils"

import { MemberActionItems } from "./member-actions"

type Group = { key: string; label: string; members: Member[] }

function MemberRow({
  serverId,
  member,
  color,
  isOwner,
  status,
}: {
  serverId: string
  member: Member
  color?: string
  isOwner: boolean
  status: LiveStatus | undefined
}) {
  const name = memberDisplayName(member)
  const custom = activeCustomStatus(member.profile)
  const offline = !status

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <UserPopover userId={member.user_id} serverId={serverId} side="left">
          <button
            type="button"
            className={cn(
              "group mx-2 flex h-11 w-[calc(100%-1rem)] items-center gap-3 rounded-md px-2 text-left hover:bg-item-hover hover:opacity-100 data-[state=open]:bg-item-selected data-[state=open]:opacity-100",
              offline && "opacity-40"
            )}
          >
            <UserAvatar
              userId={member.user_id}
              name={name}
              src={member.profile.avatar_url}
              status={status}
              surface="sidebar"
              className="size-8"
            />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="flex items-center gap-1">
                <span
                  className="truncate text-[15px] font-medium text-muted-foreground group-hover:text-interactive-hover"
                  style={color ? { color } : undefined}
                >
                  {name}
                </span>
                {isOwner && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <CrownIcon className="size-3.5 shrink-0 text-status-idle" aria-label="Server Owner" />
                    </TooltipTrigger>
                    <TooltipContent side="top">Server Owner</TooltipContent>
                  </Tooltip>
                )}
                {isTimedOut(member) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ClockIcon className="size-3.5 shrink-0 text-mention" aria-label="Timed out" />
                    </TooltipTrigger>
                    <TooltipContent side="top">Timed out</TooltipContent>
                  </Tooltip>
                )}
              </span>
              {custom && !offline && (
                <span className="block truncate text-xs text-muted-foreground">
                  {[custom.emoji, custom.text].filter(Boolean).join(" ")}
                </span>
              )}
            </span>
          </button>
        </UserPopover>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <MemberActionItems kind="context" serverId={serverId} userId={member.user_id} />
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * Online members grouped by their highest hoisted role (then "Online"), and everyone
 * else under "Offline", as in Discord.
 */
export function MemberList({ serverId }: { serverId: string }) {
  const { data: server } = useServer(serverId)
  const { data: members, isPending } = useMembers(serverId)
  const { data: roles } = useRoles(serverId)
  const presence = usePresenceStore((s) => s.byUser)

  const rolesById = useMemo(() => new Map((roles ?? []).map((r) => [r.id, r] as [string, Role])), [roles])

  const groups = useMemo<Group[]>(() => {
    if (!members) return []
    const byName = (a: Member, b: Member) =>
      memberDisplayName(a).localeCompare(memberDisplayName(b), undefined, { sensitivity: "base" })
    const hoisted = new Map<string, Group & { position: number }>()
    const online: Member[] = []
    const offline: Member[] = []
    for (const member of members) {
      if (!presence[member.user_id]) {
        offline.push(member)
        continue
      }
      const role = memberHoistRole(member, rolesById)
      if (!role) {
        online.push(member)
        continue
      }
      const group = hoisted.get(role.id) ?? { key: role.id, label: role.name, members: [], position: role.position }
      group.members.push(member)
      hoisted.set(role.id, group)
    }
    return [
      ...[...hoisted.values()].sort((a, b) => b.position - a.position),
      { key: "online", label: "Online", members: online },
      { key: "offline", label: "Offline", members: offline },
    ]
      .filter((g) => g.members.length > 0)
      .map((g) => ({ ...g, members: g.members.sort(byName) }))
  }, [members, rolesById, presence])

  if (isPending) return <MemberListSkeleton />

  return (
    <div className="scrollbar-thin h-full overflow-y-auto pb-4" aria-label="Members">
      {groups.map((group) => (
        <section key={group.key}>
          <h3 className="px-4 pt-6 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {group.label} — {group.members.length}
          </h3>
          {group.members.map((member) => (
            <MemberRow
              key={member.id}
              serverId={serverId}
              member={member}
              color={memberColor(member, rolesById)}
              isOwner={member.user_id === server?.owner_id}
              status={presence[member.user_id]}
            />
          ))}
        </section>
      ))}
    </div>
  )
}
