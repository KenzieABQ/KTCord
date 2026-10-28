"use client"

import { format } from "date-fns"
import { SearchIcon } from "lucide-react"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "@/lib/toast"

import { UserAvatar } from "@/components/profile/user-avatar"
import { SettingsSection } from "@/components/settings/settings-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { errorMessage } from "@/lib/api/errors"
import { hasPermission, Permission } from "@/lib/permissions"
import { displayNameOf } from "@/lib/profile-display"
import { useBans, useUnbanMember } from "@/lib/queries/moderation"
import { useServerPermissions } from "@/lib/queries/servers"

/** Server Settings → Bans: who's banned, why, and Unban. */
export function BansSettings() {
  const { serverId } = useParams<{ serverId: string }>()
  const { permissions } = useServerPermissions(serverId)
  const allowed = hasPermission(permissions, Permission.BAN_MEMBERS)
  const { data: bans, isPending } = useBans(serverId, allowed)
  const unban = useUnbanMember(serverId)
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (bans ?? []).filter((b) => {
      if (!q) return true
      const name = displayNameOf(b.user).toLowerCase()
      return name.includes(q) || b.user?.username.includes(q)
    })
  }, [bans, search])

  if (!allowed) {
    return (
      <SettingsSection title="Bans">
        <p className="text-muted-foreground">You need the Ban Members permission to see bans.</p>
      </SettingsSection>
    )
  }

  return (
    <SettingsSection
      title="Bans"
      description="Banned people can't rejoin, even with an invite. Unbanning lets them join again with a new invite."
    >
      <div className="relative mb-4">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search bans by username"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
          aria-label="Search bans"
        />
      </div>
      {isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full bg-item-selected/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">
          {bans?.length ? "No bans match." : "No bans. Hopefully it stays that way."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((ban) => {
            const name = displayNameOf(ban.user)
            return (
              <li key={ban.user_id} className="flex items-center gap-3 py-3">
                <UserAvatar userId={ban.user_id} name={name} src={ban.user?.avatar_url} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-header">
                    {name} <span className="text-xs font-normal text-muted-foreground">{ban.user?.username}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ban.reason ? `Reason: ${ban.reason}` : "No reason given"} · {format(new Date(ban.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={unban.isPending}
                  onClick={() =>
                    unban.mutate(ban.user_id, {
                      onSuccess: () => toast.success(`Unbanned ${name}.`),
                      onError: (e) => toast.error(errorMessage(e)),
                    })
                  }
                >
                  Unban
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </SettingsSection>
  )
}
