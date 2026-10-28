"use client"

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ChevronDownIcon,
  LinkIcon,
  LockIcon,
  PlusIcon,
  SettingsIcon,
  UserPlusIcon,
} from "@/components/icons"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"
import { toast } from "@/lib/toast"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { ChannelIcon } from "@/components/servers/channel-icon"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useJoinVoice } from "@/components/voice/use-join-voice"
import { VoiceOccupants } from "@/components/voice/voice-occupants"
import type { Channel } from "@/lib/api/channels"
import { errorMessage } from "@/lib/api/errors"
import {
  flattenTree,
  moveCategory,
  placementsFromOrder,
  type ChannelTree,
} from "@/lib/channels/tree"
import { hasPermission, Permission } from "@/lib/permissions"
import { isChannelMuted } from "@/lib/notifications"
import { useReorderChannels } from "@/lib/queries/servers"
import { useNotificationPrefs } from "@/lib/queries/settings"
import { useUiStore } from "@/lib/stores/ui-store"
import { useChannelUnread } from "@/lib/stores/unread-store"
import { useVoiceStore, useWatchVoiceChannels } from "@/lib/stores/voice-store"

import { ChannelNotificationItems } from "./notification-menu-items"
import { cn } from "@/lib/utils"

/** Full-page Channel Settings (Discord-style), opened from the gear and the context menu. */
export const channelSettingsHref = (serverId: string, channelId: string) =>
  `/servers/${serverId}/channels/${channelId}/settings/overview`

function HoverIcon({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onClick()
          }}
          className="text-interactive hover:text-interactive-hover"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

function copyText(text: string, what: string) {
  void navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied.`))
}

function Sortable({
  id,
  disabled,
  children,
}: {
  id: string
  disabled: boolean
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "relative z-10 opacity-60")}
      {...attributes}
      {...listeners}
      // Keep the row a normal link/button for screen readers; dnd-kit adds role="button".
      role={undefined}
      tabIndex={undefined}
    >
      {children}
    </div>
  )
}

function ChannelRow({
  serverId,
  channel,
  active,
  canManage,
  canInvite,
  nested,
}: {
  serverId: string
  channel: Channel
  active: boolean
  canManage: boolean
  canInvite: boolean
  nested: boolean
}) {
  const openDialog = useUiStore((s) => s.openDialog)
  const router = useRouter()
  const { unread: rawUnread, mentions } = useChannelUnread(channel.id)
  const prefs = useNotificationPrefs()
  const muted = isChannelMuted(prefs, channel.id)
  const unread = rawUnread && !active && !muted
  const href = `/channels/${serverId}/${channel.id}`
  const { join } = useJoinVoice(serverId)
  const connectedHere = useVoiceStore((s) => s.connection?.channelId === channel.id)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Link
          href={href}
          onClick={() => {
            if (channel.type === "voice" && !connectedHere) join(channel.id)
          }}
          aria-current={active ? "page" : undefined}
          className={cn(
            "group relative mx-2.5 mb-0.5 flex h-9 items-center gap-2 rounded-md px-2.5 transition-colors",
            nested ? "ml-2" : "",
            muted && !active && "opacity-40",
            active
              ? "bg-item-selected text-interactive-active"
              : unread
                ? "text-interactive-active hover:bg-item-hover"
                : "text-muted-foreground hover:bg-item-hover hover:text-interactive-hover"
          )}
        >
          {unread && (
            <span aria-hidden className="absolute top-1/2 -left-2.5 h-2 w-1 -translate-y-1/2 rounded-r-full bg-header" />
          )}
          <span className="relative shrink-0">
            <ChannelIcon type={channel.type} className="size-5 opacity-70" />
            {channel.is_private && (
              <LockIcon
                aria-label="Private channel"
                className="absolute -top-1 -right-1 size-2.5 rounded-sm bg-sidebar p-px text-current"
              />
            )}
          </span>
          <span className={cn("min-w-0 flex-1 truncate text-[15px]", unread ? "font-semibold" : "font-medium")}>
            {channel.name}
            {unread && <span className="sr-only"> (unread)</span>}
          </span>
          {mentions > 0 && !active && (
            <span
              aria-label={`${mentions} mentions`}
              className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-mention px-1 text-[11px] font-bold text-white group-hover:hidden"
            >
              {mentions > 99 ? "99+" : mentions}
            </span>
          )}
          <span
            className={cn(
              "hidden shrink-0 items-center gap-1 group-hover:flex group-focus-visible:flex",
              active && "flex"
            )}
          >
            {canInvite && (
              <HoverIcon label="Create Invite" onClick={() => openDialog({ kind: "invite", serverId })}>
                <UserPlusIcon className="size-4" />
              </HoverIcon>
            )}
            {canManage && (
              <HoverIcon
                label="Edit Channel"
                onClick={() => router.push(channelSettingsHref(serverId, channel.id))}
              >
                <SettingsIcon className="size-4" />
              </HoverIcon>
            )}
          </span>
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {channel.type === "text" && (
          <>
            <ChannelNotificationItems kind="context" channelId={channel.id} />
            <ContextMenuSeparator />
          </>
        )}
        {canInvite && (
          <ContextMenuItem onSelect={() => openDialog({ kind: "invite", serverId })}>
            <UserPlusIcon /> Invite People
          </ContextMenuItem>
        )}
        <ContextMenuItem onSelect={() => copyText(`${window.location.origin}${href}`, "Link")}>
          <LinkIcon /> Copy Link
        </ContextMenuItem>
        {canManage && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => router.push(channelSettingsHref(serverId, channel.id))}
            >
              <SettingsIcon /> Edit Channel
            </ContextMenuItem>
          </>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => copyText(channel.id, "Channel ID")}>Copy Channel ID</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function CategoryRow({
  serverId,
  category,
  collapsed,
  canManage,
}: {
  serverId: string
  category: Channel
  collapsed: boolean
  canManage: boolean
}) {
  const openDialog = useUiStore((s) => s.openDialog)
  const router = useRouter()
  const toggleCategory = useUiStore((s) => s.toggleCategory)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group flex items-center pt-5 pr-3 pb-1.5 pl-2">
          <button
            type="button"
            onClick={() => toggleCategory(category.id)}
            aria-expanded={!collapsed}
            className="flex min-w-0 flex-1 items-center gap-0.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-interactive-hover"
          >
            <ChevronDownIcon className={cn("size-3 shrink-0 transition-transform", collapsed && "-rotate-90")} />
            <span className="truncate">{category.name}</span>
          </button>
          {canManage && (
            <HoverIcon
              label="Create Channel"
              onClick={() => openDialog({ kind: "create-channel", serverId, parentId: category.id })}
            >
              <PlusIcon className="size-4" />
            </HoverIcon>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={() => toggleCategory(category.id)}>
          {collapsed ? "Expand Category" : "Collapse Category"}
        </ContextMenuItem>
        {canManage && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => openDialog({ kind: "create-channel", serverId, parentId: category.id })}
            >
              <PlusIcon /> Create Channel
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => router.push(channelSettingsHref(serverId, category.id))}
            >
              <SettingsIcon /> Edit Category
            </ContextMenuItem>
          </>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => copyText(category.id, "Category ID")}>Copy Category ID</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * The channel tree with collapsible categories. Members with MANAGE_CHANNELS can drag
 * channels between categories, and drag categories (with their channels) to reorder them.
 */
export function ChannelList({
  serverId,
  tree,
  permissions,
}: {
  serverId: string
  tree: ChannelTree
  permissions: number
}) {
  const params = useParams<{ channelId?: string }>()
  const collapsed = useUiStore((s) => s.collapsedCategories)
  const reorder = useReorderChannels(serverId)
  const [draggingCategory, setDraggingCategory] = useState(false)

  const canManage = hasPermission(permissions, Permission.MANAGE_CHANNELS)
  const canInvite = hasPermission(permissions, Permission.CREATE_INVITE)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const full = flattenTree(tree)
  useWatchVoiceChannels(full.filter((c) => c.type === "voice").map((c) => c.id))
  const isHidden = (c: Channel) =>
    c.type !== "category" &&
    c.parent_id !== null &&
    (draggingCategory || (collapsed[c.parent_id] && c.id !== params.channelId))
  const visible = full.filter((c) => !isHidden(c))

  function save(order: Channel[]) {
    const placements = placementsFromOrder(order)
    if (placements.length === 0) return
    reorder.mutate(placements, { onError: (err) => toast.error(errorMessage(err)) })
  }

  function onDragStart(event: DragStartEvent) {
    const channel = full.find((c) => c.id === event.active.id)
    setDraggingCategory(channel?.type === "category")
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const wasCategory = draggingCategory
    setDraggingCategory(false)
    if (!over || active.id === over.id) return

    const from = visible.findIndex((c) => c.id === active.id)
    const to = visible.findIndex((c) => c.id === over.id)
    if (from === -1 || to === -1) return
    const moved = arrayMove(visible, from, to)

    if (wasCategory) {
      // Count the categories above the drop point to get the new category index.
      const targetIndex = moved
        .slice(0, moved.findIndex((c) => c.id === active.id))
        .filter((c) => c.type === "category").length
      save(moveCategory(tree, String(active.id), targetIndex))
      return
    }

    // Re-insert channels hidden inside collapsed categories right after their category.
    const order: Channel[] = []
    for (const channel of moved) {
      order.push(channel)
      if (channel.type === "category") {
        order.push(...full.filter((c) => c.parent_id === channel.id && isHidden(c)))
      }
    }
    save(order)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggingCategory(false)}
    >
      <SortableContext items={visible.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="pb-4">
          {visible.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No channels you can see yet.
            </p>
          )}
          {visible.map((channel) => (
            <Sortable key={channel.id} id={channel.id} disabled={!canManage}>
              {channel.type === "category" ? (
                <CategoryRow
                  serverId={serverId}
                  category={channel}
                  collapsed={Boolean(collapsed[channel.id]) || draggingCategory}
                  canManage={canManage}
                />
              ) : (
                <div className={channel === visible[0] ? "pt-3" : undefined}>
                  <ChannelRow
                    serverId={serverId}
                    channel={channel}
                    active={params.channelId === channel.id}
                    canManage={canManage}
                    canInvite={canInvite}
                    nested={channel.parent_id !== null}
                  />
                  {channel.type === "voice" && <VoiceOccupants serverId={serverId} channelId={channel.id} />}
                </div>
              )}
            </Sortable>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
