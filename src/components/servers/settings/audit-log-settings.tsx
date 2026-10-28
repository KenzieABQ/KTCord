"use client"

import { format, formatDistanceToNowStrict } from "date-fns"
import { ChevronDownIcon, ScrollTextIcon } from "@/components/icons"
import { useParams } from "next/navigation"
import { useState } from "react"

import { UserAvatar } from "@/components/profile/user-avatar"
import { SettingsSection } from "@/components/settings/settings-layout"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { AuditEntry } from "@/lib/api/moderation"
import { AUDIT_FILTERS, describeAudit } from "@/lib/audit"
import { memberDisplayName } from "@/lib/members"
import { hasPermission, Permission } from "@/lib/permissions"
import { displayNameOf } from "@/lib/profile-display"
import { useAuditLog } from "@/lib/queries/moderation"
import { useMembers, useServerPermissions } from "@/lib/queries/servers"
import { cn } from "@/lib/utils"

const ALL = "all"

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false)
  const { verb, target, lines } = describeAudit(entry)
  const actor = entry.actor ? displayNameOf(entry.actor) : "Someone"
  const when = new Date(entry.created_at)

  return (
    <li className="rounded-md bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={lines.length === 0}
        aria-expanded={lines.length ? open : undefined}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left enabled:hover:bg-item-hover"
      >
        <UserAvatar userId={entry.actor_id ?? entry.id} name={actor} src={entry.actor?.avatar_url} className="size-9" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-header">{actor}</span> {verb}
            {target && <span className="font-medium text-header"> {target}</span>}
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <time dateTime={entry.created_at} className="text-xs text-muted-foreground">
                {formatDistanceToNowStrict(when, { addSuffix: true })}
              </time>
            </TooltipTrigger>
            <TooltipContent>{format(when, "PPpp")}</TooltipContent>
          </Tooltip>
        </div>
        {lines.length > 0 && (
          <ChevronDownIcon
            aria-hidden
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        )}
      </button>
      {open && lines.length > 0 && (
        <ul className="border-t border-border px-3 py-2 pl-15 text-sm text-foreground">
          {lines.map((line, i) => (
            <li key={i} className="py-0.5 break-words">
              {line}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/** Server Settings → Audit Log: who changed what, newest first, filterable by person and action. */
export function AuditLogSettings() {
  const { serverId } = useParams<{ serverId: string }>()
  const { permissions } = useServerPermissions(serverId)
  const allowed = hasPermission(permissions, Permission.VIEW_AUDIT_LOG)
  const { data: members } = useMembers(serverId)
  const [actorId, setActorId] = useState(ALL)
  const [action, setAction] = useState(ALL)
  const log = useAuditLog(
    serverId,
    { actorId: actorId === ALL ? undefined : actorId, action: action === ALL ? undefined : action },
    allowed
  )

  if (!allowed) {
    return (
      <SettingsSection title="Audit Log">
        <p className="text-muted-foreground">You need the View Audit Log permission to see this page.</p>
      </SettingsSection>
    )
  }

  const entries = log.data?.pages.flat() ?? []
  const filtered = actorId !== ALL || action !== ALL

  return (
    <SettingsSection title="Audit Log" description="A record of changes made to this server and who made them.">
      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={actorId} onValueChange={setActorId}>
          <SelectTrigger className="w-52 bg-input" aria-label="Filter by user">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All users</SelectItem>
            {(members ?? []).map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>
                {memberDisplayName(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-52 bg-input" aria-label="Filter by action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All actions</SelectItem>
            {AUDIT_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {log.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full bg-item-selected/60" />
          ))}
        </div>
      ) : log.isError ? (
        <p className="py-10 text-center text-muted-foreground">Couldn&apos;t load the audit log. Try again later.</p>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
          <ScrollTextIcon aria-hidden className="size-10" />
          <p>{filtered ? "No entries match these filters." : "Nothing here yet. Changes to the server will show up here."}</p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </ul>
          {log.hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" disabled={log.isFetchingNextPage} onClick={() => void log.fetchNextPage()}>
                {log.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}
    </SettingsSection>
  )
}
