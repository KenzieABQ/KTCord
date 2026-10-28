"use client"

import { XIcon } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"

import { Skeleton } from "@/components/ui/skeleton"
import { dmTitle, type DmChannel } from "@/lib/api/dms"
import { activeCustomStatus } from "@/lib/custom-status"
import { useCloseDm, useVisibleDms } from "@/lib/queries/social"
import { useUserId } from "@/lib/stores/auth-store"
import { useChannelUnread } from "@/lib/stores/unread-store"
import { cn } from "@/lib/utils"

import { DmAvatar } from "./dm-avatar"

function DmRow({ dm, active }: { dm: DmChannel; active: boolean }) {
  const userId = useUserId()
  const closeDm = useCloseDm()
  const { unread: rawUnread, mentions } = useChannelUnread(dm.id)
  const unread = rawUnread && !active
  const other = dm.type === "dm" ? dm.recipients.find((r) => r.user_id !== userId) : undefined
  const custom = other ? activeCustomStatus(other.profile) : null
  const subtitle =
    dm.type === "group_dm"
      ? `${dm.recipients.length} Members`
      : custom
        ? [custom.emoji, custom.text].filter(Boolean).join(" ")
        : null

  return (
    <Link
      href={`/channels/me/${dm.id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative mb-0.5 flex h-12 items-center gap-3 rounded-md px-2.5 transition-colors",
        active
          ? "bg-item-selected text-interactive-active"
          : unread
            ? "text-interactive-active hover:bg-item-hover"
            : "text-muted-foreground hover:bg-item-hover hover:text-interactive-hover"
      )}
    >
      <DmAvatar dm={dm} />
      <span className="min-w-0 flex-1 leading-tight">
        <span className={cn("block truncate text-[15px]", unread ? "font-semibold" : "font-medium")}>
          {dmTitle(dm, userId)}
        </span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      {mentions > 0 && !active && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-mention px-1 text-[11px] font-bold text-white group-hover:hidden">
          {mentions > 99 ? "99+" : mentions}
        </span>
      )}
      <button
        type="button"
        aria-label="Close DM"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          closeDm.mutate(dm.id)
        }}
        className="hidden text-interactive group-hover:block hover:text-interactive-hover"
      >
        <XIcon className="size-4" />
      </button>
    </Link>
  )
}

export function DmList() {
  const params = useParams<{ channelId?: string }>()
  const { data: dms, isPending } = useVisibleDms()

  if (isPending) {
    return (
      <div className="flex flex-col gap-3 px-2 py-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full bg-item-selected/60" />
            <Skeleton className="h-3.5 w-28 bg-item-selected/60" />
          </div>
        ))}
      </div>
    )
  }
  if (!dms?.length) {
    return <p className="px-2.5 py-2 text-sm text-muted-foreground">No conversations yet.</p>
  }
  return (
    <div className="flex flex-col gap-0.5">
      {dms.map((dm) => (
        <DmRow key={dm.id} dm={dm} active={params.channelId === dm.id} />
      ))}
    </div>
  )
}
