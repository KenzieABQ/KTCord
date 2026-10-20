"use client"

import { ClockIcon, CrownIcon } from "lucide-react"
import { useMemo } from "react"

import { MemberListSkeleton } from "@/components/layout/skeletons"
import { UserAvatar } from "@/components/profile/user-avatar"
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Member, Role } from "@/lib/api/members"
import { memberColor, memberDisplayName, memberHoistRole } from "@/lib/members"
import { isTimedOut } from "@/lib/moderation"
import { useMembers, useRoles, useServer } from "@/lib/queries/servers"

import { MemberActionItems } from "./member-actions"

type Group = { key: string; label: string; members: Member[] }

function MemberRow({
  serverId,
  member,
  color,
  isOwner,
}: {
  serverId: string
  member: Member
  color?: string
  isOwner: boolean
}) {
  const name = memberDisplayName(member)
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group mx-2 flex h-11 items-center gap-3 rounded-md px-2 hover:bg-item-hover">
          <UserAvatar
            userId={member.user_id}
            name={name}
            src={member.profile.avatar_url}
            className="size-8"
          />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-1">
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
            </div>
            {member.profile.custom_status_text && (
              <p className="truncate text-xs text-muted-foreground">
                {member.profile.custom_status_emoji} {member.profile.custom_status_text}
              </p>
            )}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56 bg-floating">
        <MemberActionItems kind="context" serverId={serverId} userId={member.user_id} />
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * Server members grouped by their highest hoisted role, then everyone else.
 * Online/Offline grouping joins when presence lands (Milestone 5).
 */
export function MemberList({ serverId }: { serverId: string }) {
  const { data: server } = useServer(serverId)
  const { data: members, isPending } = useMembers(serverId)
  const { data: roles } = useRoles(serverId)

  const rolesById = useMemo(() => new Map((roles ?? []).map((r) => [r.id, r] as [string, Role])), [roles])

  const groups = useMemo<Group[]>(() => {
    if (!members) return []
    const byName = (a: Member, b: Member) =>
      memberDisplayName(a).localeCompare(memberDisplayName(b), undefined, { sensitivity: "base" })
    const hoisted = new Map<string, Group & { position: number }>()
    const rest: Member[] = []
    for (const member of members) {
      const role = memberHoistRole(member, rolesById)
      if (!role) {
        rest.push(member)
        continue
      }
      const group = hoisted.get(role.id) ?? {
        key: role.id,
        label: role.name,
        members: [],
        position: role.position,
      }
      group.members.push(member)
      hoisted.set(role.id, group)
    }
    return [
      ...[...hoisted.values()].sort((a, b) => b.position - a.position),
      { key: "members", label: "Members", members: rest },
    ]
      .filter((g) => g.members.length > 0)
      .map((g) => ({ ...g, members: g.members.sort(byName) }))
  }, [members, rolesById])

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
            />
          ))}
        </section>
      ))}
    </div>
  )
}
