"use client"

import { useQueryClient } from "@tanstack/react-query"

import { CopyIcon, EyeIcon, PhoneIcon, VideoIcon, XIcon } from "@/components/icons"
import { UserContactItems, UserCopyItems } from "@/components/members/user-actions"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { startDmCall } from "@/components/voice/dm-call"
import { prefetchMessages } from "@/lib/queries/messages"
import { useMarkChannelRead } from "@/lib/queries/settings"
import { useVoiceRoster } from "@/lib/stores/voice-store"
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
  const queryClient = useQueryClient()
  const { mutate: markRead } = useMarkChannelRead()
  const inCall = useVoiceRoster(dm.id).length > 0
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
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Link
          href={`/channels/me/${dm.id}`}
          onPointerEnter={() => prefetchMessages(queryClient, dm.id)}
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
          <span className="relative shrink-0">
            <DmAvatar dm={dm} />
            {inCall && (
              <span
                aria-label="Call in progress"
                className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-status-online text-white ring-2 ring-sidebar"
              >
                <PhoneIcon className="size-2.5" />
              </span>
            )}
          </span>
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
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem disabled={!rawUnread} onSelect={() => markRead(dm.id)}>
          <EyeIcon /> Mark as Read
        </ContextMenuItem>
        <ContextMenuSeparator />
        {other ? (
          <>
            <UserContactItems kind="context" userId={other.user_id} message={false} />
            <ContextMenuSeparator />
            <UserCopyItems kind="context" userId={other.user_id} username={other.profile.username} />
          </>
        ) : (
          <>
            <ContextMenuItem onSelect={() => startDmCall(dm.id)}>
              <PhoneIcon /> Start Call
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => startDmCall(dm.id, true)}>
              <VideoIcon /> Start Video Call
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => void navigator.clipboard.writeText(dm.id)}>
              <CopyIcon /> Copy Channel ID
            </ContextMenuItem>
          </>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={() => closeDm.mutate(dm.id)}>
          <XIcon /> Close DM
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
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
