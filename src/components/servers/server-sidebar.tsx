"use client"

import {
  ChevronDownIcon,
  FolderPlusIcon,
  LogOutIcon,
  PlusCircleIcon,
  SettingsIcon,
  UserPlusIcon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { ChannelListSkeleton } from "@/components/layout/skeletons"
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

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          disabled={!server}
          className={cn(
            "flex h-12 shrink-0 items-center gap-2 px-4 text-left font-semibold text-header shadow-[0_1px_0_rgb(0_0_0/0.2)] transition-colors outline-none hover:bg-item-hover focus-visible:bg-item-hover",
            menuOpen && "bg-item-hover"
          )}
        >
          {serverPending ? (
            <Skeleton className="h-4 w-32 bg-item-selected/60" />
          ) : (
            <span className="min-w-0 flex-1 truncate">{server?.name ?? "Server not found"}</span>
          )}
          {menuOpen ? <XIcon className="size-4 shrink-0" /> : <ChevronDownIcon className="size-4 shrink-0" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-56 bg-floating p-1.5">
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
              <DropdownMenuItem
                onSelect={() => openDialog({ kind: "create-channel", serverId, parentId: null })}
              >
                Create Channel <PlusCircleIcon className="ml-auto" />
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openDialog({ kind: "create-category", serverId })}>
                Create Category <FolderPlusIcon className="ml-auto" />
              </DropdownMenuItem>
            </>
          )}
          {!isOwner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => openDialog({ kind: "leave-server", serverId })}
              >
                Leave Server <LogOutIcon className="ml-auto" />
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {channelsPending || !tree ? (
          <ChannelListSkeleton />
        ) : (
          <ChannelList serverId={serverId} tree={tree} permissions={permissions} />
        )}
      </div>
    </>
  )
}
