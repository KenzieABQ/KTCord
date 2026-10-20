"use client"

import { CompassIcon, LogOutIcon, PlusIcon, UserPlusIcon } from "lucide-react"
import { useParams, usePathname } from "next/navigation"

import { KtcordMark } from "@/components/brand/logo"
import { ServerNotificationItems } from "@/components/servers/notification-menu-items"
import { ServerIcon } from "@/components/servers/server-icon"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useMyServers } from "@/lib/queries/servers"
import type { JoinedServer } from "@/lib/api/servers"
import { useUiStore } from "@/lib/stores/ui-store"
import { useServerUnread } from "@/lib/stores/unread-store"
import { isServerMuted } from "@/lib/notifications"
import { useNotificationPrefs } from "@/lib/queries/settings"
import { useUserId } from "@/lib/stores/auth-store"

import { RailItem } from "./rail-item"

export function ServerRail() {
  const pathname = usePathname()
  const params = useParams<{ serverId?: string }>()
  const openDialog = useUiStore((s) => s.openDialog)
  const lastChannelByServer = useUiStore((s) => s.lastChannelByServer)
  const { data: servers, isPending } = useMyServers()
  const homeActive = pathname.startsWith("/channels/me")

  return (
    <nav
      aria-label="Servers"
      className="scrollbar-none flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto bg-rail pt-3 pb-3"
    >
      <RailItem label="Direct Messages" href="/channels/me" active={homeActive} variant="brand">
        <KtcordMark className="size-7" />
      </RailItem>

      <div className="mx-auto h-0.5 w-8 shrink-0 rounded-full bg-item-selected" role="separator" />

      {isPending &&
        Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="size-12 shrink-0 rounded-full bg-item-selected/60" />
        ))}

      {servers?.map((server) => (
        <ServerRailItem
          key={server.id}
          server={server}
          lastChannelId={lastChannelByServer[server.id]}
          active={params.serverId === server.id}
        />
      ))}

      <RailItem label="Add a Server" onClick={() => openDialog({ kind: "create-server" })} variant="action">
        <PlusIcon className="size-6" />
      </RailItem>
      <RailItem
        label="Join with an Invite"
        onClick={() => openDialog({ kind: "join-server" })}
        variant="action"
      >
        <CompassIcon className="size-6" />
      </RailItem>
    </nav>
  )
}

function ServerRailItem({
  server,
  lastChannelId,
  active,
}: {
  server: JoinedServer
  lastChannelId: string | undefined
  active: boolean
}) {
  const { unread, mentions } = useServerUnread(server.id)
  const prefs = useNotificationPrefs()
  const openDialog = useUiStore((s) => s.openDialog)
  const userId = useUserId()
  const muted = isServerMuted(prefs, server.id)
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="w-full">
          <RailItem
            label={server.name}
            href={lastChannelId ? `/channels/${server.id}/${lastChannelId}` : `/channels/${server.id}`}
            active={active}
            unread={unread && !muted}
            mentions={mentions}
          >
            <ServerIcon name={server.name} iconUrl={server.icon_url} />
          </RailItem>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56 bg-floating">
        <ServerNotificationItems kind="context" serverId={server.id} />
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => openDialog({ kind: "invite", serverId: server.id })}>
          <UserPlusIcon /> Invite People
        </ContextMenuItem>
        {server.owner_id !== userId && (
          <ContextMenuItem variant="destructive" onSelect={() => openDialog({ kind: "leave-server", serverId: server.id })}>
            <LogOutIcon /> Leave Server
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
