"use client"

import { format } from "date-fns"
import { ClockIcon, MoreVerticalIcon, PlusIcon, SearchIcon, XIcon } from "@/components/icons"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "@/lib/toast"

import { MemberActionItems } from "@/components/members/member-actions"
import { UserAvatar } from "@/components/profile/user-avatar"
import { SettingsSection } from "@/components/settings/settings-layout"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { errorMessage } from "@/lib/api/errors"
import type { Member, Role } from "@/lib/api/members"
import { memberDisplayName } from "@/lib/members"
import { isTimedOut, useModerationAbilities } from "@/lib/moderation"
import { hasPermission, Permission } from "@/lib/permissions"
import { useSetMemberRoles } from "@/lib/queries/moderation"
import { useMembers, useRoles, useServer, useServerPermissions } from "@/lib/queries/servers"

function MemberRoles({ serverId, member, rolesById }: { serverId: string; member: Member; rolesById: Map<string, Role> }) {
  const { assignableRoles } = useModerationAbilities(serverId, member.user_id)
  const setRoles = useSetMemberRoles(serverId)
  const assignable = new Set(assignableRoles.map((r) => r.id))
  const roles = member.role_ids
    .map((id) => rolesById.get(id))
    .filter((r): r is Role => Boolean(r))
    .sort((a, b) => b.position - a.position)

  const update = (roleIds: string[]) =>
    setRoles.mutate({ userId: member.user_id, roleIds }, { onError: (e) => toast.error(errorMessage(e)) })

  return (
    <div className="flex flex-wrap items-center gap-1">
      {roles.map((role) => (
        <span
          key={role.id}
          className="group/chip flex items-center gap-1 rounded-sm bg-sidebar px-1.5 py-0.5 text-xs text-foreground"
        >
          <span className="size-2.5 rounded-full" style={{ backgroundColor: role.color ?? "#99aab5" }} />
          {role.name}
          {assignable.has(role.id) && (
            <button
              type="button"
              aria-label={`Remove ${role.name}`}
              onClick={() => update(member.role_ids.filter((id) => id !== role.id))}
              className="hidden text-muted-foreground group-hover/chip:inline hover:text-foreground"
            >
              <XIcon className="size-3" />
            </button>
          )}
        </span>
      ))}
      {assignableRoles.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Add role"
            className="flex size-5 items-center justify-center rounded-sm bg-sidebar text-muted-foreground hover:text-foreground"
          >
            <PlusIcon className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-72 w-52 overflow-y-auto">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Roles</DropdownMenuLabel>
            {assignableRoles.map((role) => (
              <DropdownMenuCheckboxItem
                key={role.id}
                checked={member.role_ids.includes(role.id)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(checked) =>
                  update(checked ? [...member.role_ids, role.id] : member.role_ids.filter((id) => id !== role.id))
                }
              >
                <span className="size-3 rounded-full" style={{ backgroundColor: role.color ?? "#99aab5" }} />
                {role.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

/** Server Settings → Members: search, roles per member, and moderation actions. */
export function MembersSettings() {
  const { serverId } = useParams<{ serverId: string }>()
  const { data: server } = useServer(serverId)
  const { data: members } = useMembers(serverId)
  const { data: roles } = useRoles(serverId)
  const { permissions } = useServerPermissions(serverId)
  const [search, setSearch] = useState("")

  const rolesById = useMemo(() => new Map((roles ?? []).map((r) => [r.id, r])), [roles])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (members ?? []).filter(
      (m) => !q || memberDisplayName(m).toLowerCase().includes(q) || m.profile.username.includes(q)
    )
  }, [members, search])

  const allowed = [Permission.MANAGE_ROLES, Permission.KICK_MEMBERS, Permission.BAN_MEMBERS, Permission.MODERATE_MEMBERS].some(
    (bit) => hasPermission(permissions, bit)
  )
  if (!allowed) {
    return (
      <SettingsSection title="Members">
        <p className="text-muted-foreground">You don&apos;t have permission to manage members.</p>
      </SettingsSection>
    )
  }

  return (
    <SettingsSection title="Server Members" description={`${members?.length ?? 0} members`}>
      <div className="relative mb-4">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search members"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
          aria-label="Search members"
        />
      </div>

      <ul className="divide-y divide-border">
        {filtered.map((member) => {
          const name = memberDisplayName(member)
          return (
            <li key={member.id} className="flex items-start gap-3 py-3">
              <UserAvatar userId={member.user_id} name={name} src={member.profile.avatar_url} className="size-10" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-header">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">{member.profile.username}</span>
                  {member.user_id === server?.owner_id && (
                    <span className="rounded-sm bg-status-idle/20 px-1 text-[10px] font-bold text-status-idle uppercase">
                      Owner
                    </span>
                  )}
                  {isTimedOut(member) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ClockIcon className="size-3.5 text-mention" aria-label="Timed out" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Timed out until {format(new Date(member.timeout_until!), "MMM d, h:mm a")}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <p className="mb-1.5 text-xs text-muted-foreground">
                  Member since {format(new Date(member.joined_at), "MMM d, yyyy")}
                </p>
                <MemberRoles serverId={serverId} member={member} rolesById={rolesById} />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Actions for ${name}`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-interactive hover:bg-item-hover hover:text-interactive-hover"
                >
                  <MoreVerticalIcon className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <MemberActionItems kind="dropdown" serverId={serverId} userId={member.user_id} />
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          )
        })}
        {filtered.length === 0 && <li className="py-8 text-center text-muted-foreground">No members match.</li>}
      </ul>
    </SettingsSection>
  )
}
