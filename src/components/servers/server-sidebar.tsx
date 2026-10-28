"use client"

import {
  CalendarPlusIcon,
  ChevronDownIcon,
  FolderPlusIcon,
  LogOutIcon,
  PlusCircleIcon,
  SettingsIcon,
  UserPlusIcon,
  XIcon,
} from "@/components/icons"
import Link from "next/link"
import { useState } from "react"

import { EventsRow } from "@/components/events/events"
import { ChannelListSkeleton } from "@/components/layout/skeletons"
import { AnimatedImage } from "@/components/ui/animated-image"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { hasPermission, Permission } from "@/lib/permissions"
import { useChannelTree, useServer, useServerPermissions } from "@/lib/queries/servers"
import { useUiStore } from "@/lib/stores/ui-store"
import { cn } from "@/lib/utils"

import { ChannelList } from "./channel-list"
import { ServerNotificationItems } from "./notification-menu-items"
import { ServerOnboarding } from "./onboarding"

/** Channel-sidebar content for a server: the name header with its menu, then the channel tree. */
export function ServerSidebar({ serverId }: { serverId: string }) {
  const { data: server, isPending: serverPending } = useServer(serverId)
  const { tree, isPending: channelsPending } = useChannelTree(serverId)
  const { permissions, isOwner } = useServerPermissions(serverId)
  const openDialog = useUiStore((s) => s.openDialog)
  const [menuOpen, setMenuOpen] = useState(false)

  const can = (bit: number) => hasPermission(permissions, bit)
  // Server Settings opens on the first page the member is allowed to use.
  const settingsPage = can(Permission.MANAGE_SERVER)
    ? "overview"
    : can(Permission.MANAGE_ROLES)
      ? "roles"
      : can(Permission.KICK_MEMBERS) || can(Permission.MODERATE_MEMBERS) || can(Permission.BAN_MEMBERS)
        ? "members"
        : null

  const banner = server?.banner_url

  return (
    <>
      <div className={cn("relative shrink-0", banner && "h-[136px]")}>
        {banner && (
          <div className="absolute inset-0 overflow-hidden">
            <AnimatedImage src={banner} animate="always" />
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent" />
          </div>
        )}
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            disabled={!server}
            className={cn(
              "relative flex h-12 w-full shrink-0 items-center gap-2 px-4 text-left font-semibold transition-colors outline-none",
              banner
                ? "text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.6)] hover:bg-black/20"
                : "border-b border-border text-header hover:bg-item-hover focus-visible:bg-item-hover",
              menuOpen && (banner ? "bg-black/20" : "bg-item-hover")
            )}
          >
            {serverPending ? (
              <Skeleton className="h-4 w-32 bg-item-selected/60" />
            ) : (
              <span className="min-w-0 flex-1 truncate">{server?.name ?? "Server not found"}</span>
            )}
            {menuOpen ? <XIcon className="size-4 shrink-0" /> : <ChevronDownIcon className="size-4 shrink-0" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-56 p-1.5">
            {can(Permission.CREATE_INVITE) && (
              <DropdownMenuItem
                className="text-[#949cf7] focus:bg-primary focus:text-white [&_svg]:text-current"
                onSelect={() => openDialog({ kind: "invite", serverId })}
              >
                Invite People <UserPlusIcon className="ml-auto" />
              </DropdownMenuItem>
            )}
            {settingsPage && (
              <DropdownMenuItem asChild>
                <Link href={`/servers/${serverId}/settings/${settingsPage}`}>
                  Server Settings <SettingsIcon className="ml-auto" />
                </Link>
              </DropdownMenuItem>
            )}
            {can(Permission.MANAGE_CHANNELS) && (
              <>
                <DropdownMenuItem onSelect={() => openDialog({ kind: "create-channel", serverId, parentId: null })}>
                  Create Channel <PlusCircleIcon className="ml-auto" />
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openDialog({ kind: "create-category", serverId })}>
                  Create Category <FolderPlusIcon className="ml-auto" />
                </DropdownMenuItem>
              </>
            )}
            {can(Permission.MANAGE_EVENTS) && (
              <DropdownMenuItem onSelect={() => openDialog({ kind: "create-event", serverId })}>
                Create Event <CalendarPlusIcon className="ml-auto" />
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <ServerNotificationItems kind="dropdown" serverId={serverId} />
            {!isOwner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => openDialog({ kind: "leave-server", serverId })}>
                  Leave Server <LogOutIcon className="ml-auto" />
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {server && <EventsRow serverId={serverId} />}
        {server && <ServerOnboarding serverId={serverId} />}
        {channelsPending || !tree ? (
          <ChannelListSkeleton />
        ) : (
          <ChannelList serverId={serverId} tree={tree} permissions={permissions} />
        )}
      </div>
    </>
  )
}
