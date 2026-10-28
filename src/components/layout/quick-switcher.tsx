"use client"

import { useQueries } from "@tanstack/react-query"
import { Command as CommandPrimitive } from "cmdk"
import { HashIcon, SearchIcon, Volume2Icon } from "@/components/icons"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "@/lib/toast"

import { DmAvatar } from "@/components/dms/dm-avatar"
import { UserAvatar } from "@/components/profile/user-avatar"
import { ServerIcon } from "@/components/servers/server-icon"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { listChannels, type Channel } from "@/lib/api/channels"
import { dmTitle } from "@/lib/api/dms"
import { errorMessage } from "@/lib/api/errors"
import { displayNameOf } from "@/lib/profile-display"
import { qk } from "@/lib/queries/keys"
import { useMyServers } from "@/lib/queries/servers"
import { useOpenDm, useRelationships, useVisibleDms } from "@/lib/queries/social"
import { rankSwitcher, switcherKey, type SwitcherItem } from "@/lib/quick-switcher"
import { useUserId } from "@/lib/stores/auth-store"
import { useUiStore } from "@/lib/stores/ui-store"
import { isChannelUnread, useUnreadStore } from "@/lib/stores/unread-store"
import { cn } from "@/lib/utils"

// Defined once so useQueries can keep the combined result stable between renders.
const channelData = (results: { data?: Channel[] }[]) => results.map((r) => r.data)

/** Everything the switcher can jump to, with unread state. */
function useSwitcherItems() {
  const userId = useUserId()
  const { data: servers } = useMyServers()
  const { data: dms } = useVisibleDms()
  const { data: relationships } = useRelationships()
  const unread = useUnreadStore((s) => s.channels)
  // Channels for every server, not just the ones opened so far (cached after the first open).
  const channelsByServer = useQueries({
    queries: (servers ?? []).map((server) => ({
      queryKey: qk.channels(server.id),
      queryFn: () => listChannels(server.id),
    })),
    combine: channelData,
  })

  return useMemo(() => {
    const items: SwitcherItem[] = []
    const status = (id: string) => ({ unread: isChannelUnread(unread[id]), mentions: unread[id]?.mentions ?? 0 })

    for (const dm of dms ?? []) {
      const others = dm.recipients.filter((r) => r.user_id !== userId)
      items.push({
        kind: "dm",
        id: dm.id,
        title: dmTitle(dm, userId),
        usernames: others.map((r) => r.profile.username),
        group: dm.type === "group_dm",
        ...status(dm.id),
      })
    }

    const dmPartners = new Set(
      (dms ?? []).filter((dm) => dm.type === "dm").flatMap((dm) => dm.recipients.map((r) => r.user_id))
    )
    for (const r of relationships ?? []) {
      if (r.kind !== "friend" || dmPartners.has(r.user.id)) continue
      items.push({
        kind: "friend",
        userId: r.user.id,
        name: displayNameOf(r.user),
        username: r.user.username,
        avatarUrl: r.user.avatar_url,
      })
    }

    ;(servers ?? []).forEach((server, i) => {
      const channels = channelsByServer[i] ?? []
      const categories = new Map(channels.filter((c) => c.type === "category").map((c) => [c.id, c.name]))
      let serverUnread = false
      let serverMentions = 0
      for (const channel of channels) {
        if (channel.type === "category") continue
        const s = status(channel.id)
        serverUnread ||= s.unread
        serverMentions += s.mentions
        items.push({
          kind: "channel",
          id: channel.id,
          serverId: server.id,
          serverName: server.name,
          name: channel.name ?? "",
          voice: channel.type === "voice",
          category: channel.parent_id ? (categories.get(channel.parent_id) ?? null) : null,
          ...s,
        })
      }
      items.push({ kind: "server", id: server.id, name: server.name, unread: serverUnread, mentions: serverMentions })
    })

    return items
  }, [servers, dms, relationships, channelsByServer, unread, userId])
}

function MentionBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-1 flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-mention px-1 text-[11px] font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  )
}

function ItemContent({ item }: { item: SwitcherItem }) {
  const { data: dms } = useVisibleDms()
  const { data: servers } = useMyServers()
  const bright = item.kind !== "friend" && (item.unread || item.mentions > 0)
  const label = (text: string) => (
    <span className={cn("min-w-0 truncate", bright ? "font-semibold text-header" : "text-interactive")}>{text}</span>
  )

  switch (item.kind) {
    case "channel": {
      const Icon = item.voice ? Volume2Icon : HashIcon
      return (
        <>
          <Icon className="size-5 text-muted-foreground" />
          {label(item.name)}
          {item.category && <span className="truncate text-xs text-muted-foreground uppercase">{item.category}</span>}
          <MentionBadge count={item.mentions} />
          <span className="ml-auto shrink-0 truncate pl-3 text-xs font-medium text-muted-foreground">{item.serverName}</span>
        </>
      )
    }
    case "dm": {
      const dm = dms?.find((d) => d.id === item.id)
      return (
        <>
          {dm && <DmAvatar dm={dm} className="size-6" showStatus={false} />}
          {label(item.title)}
          <MentionBadge count={item.mentions} />
          <span className="ml-auto shrink-0 pl-3 text-xs font-medium text-muted-foreground">
            {item.group ? "Group DM" : "Direct Message"}
          </span>
        </>
      )
    }
    case "friend":
      return (
        <>
          <UserAvatar userId={item.userId} name={item.name} src={item.avatarUrl} className="size-6" />
          {label(item.name)}
          <span className="truncate text-sm text-muted-foreground">{item.username}</span>
          <span className="ml-auto shrink-0 pl-3 text-xs font-medium text-muted-foreground">Friend</span>
        </>
      )
    case "server": {
      const server = servers?.find((s) => s.id === item.id)
      return (
        <>
          <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-rail text-[10px] font-semibold text-header">
            <ServerIcon name={item.name} iconUrl={server?.icon_url ?? null} />
          </span>
          {label(item.name)}
          <MentionBadge count={item.mentions} />
          <span className="ml-auto shrink-0 pl-3 text-xs font-medium text-muted-foreground">Server</span>
        </>
      )
    }
  }
}

function QuickSwitcherBody() {
  const router = useRouter()
  const closeDialog = useUiStore((s) => s.closeDialog)
  const recentIds = useUiStore((s) => s.recentChannelIds)
  const openDm = useOpenDm()
  const items = useSwitcherItems()
  const [query, setQuery] = useState("")
  const results = useMemo(() => rankSwitcher(items, query, recentIds), [items, query, recentIds])

  async function choose(item: SwitcherItem) {
    if (item.kind === "friend") {
      try {
        await openDm.mutateAsync(item.userId)
        closeDialog()
      } catch (error) {
        toast.error(errorMessage(error))
      }
      return
    }
    closeDialog()
    if (item.kind === "channel") router.push(`/channels/${item.serverId}/${item.id}`)
    else if (item.kind === "dm") router.push(`/channels/me/${item.id}`)
    else router.push(`/channels/${item.id}`)
  }

  return (
    <CommandPrimitive shouldFilter={false} loop label="Quick switcher" className="flex flex-col">
      <div className="px-4 pt-5 pb-3">
        <p className="mb-3 text-center text-sm text-muted-foreground">Search for servers, channels or DMs</p>
        <div className="relative">
          <CommandPrimitive.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Where would you like to go?"
            className="h-12 w-full rounded-md bg-rail px-3 pr-10 text-lg text-foreground outline-none placeholder:text-muted-foreground"
          />
          <SearchIcon className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>
      <CommandPrimitive.List className="scrollbar-thin max-h-[min(360px,50dvh)] overflow-y-auto px-2 pb-2">
        <CommandPrimitive.Empty className="px-2 py-8 text-center text-sm text-muted-foreground">
          {query.trim()
            ? "Can't find what you're looking for? Check your spelling, or try a different prefix."
            : "Nothing new here. Start typing to search."}
        </CommandPrimitive.Empty>
        {results.length > 0 && (
          <CommandPrimitive.Group
            heading={query.trim() ? undefined : "Unread & recent"}
            className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-bold **:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:uppercase"
          >
            {results.map((item) => (
              <CommandPrimitive.Item
                key={switcherKey(item)}
                value={switcherKey(item)}
                onSelect={() => void choose(item)}
                className="flex h-10 cursor-pointer items-center gap-2.5 rounded-md px-2 text-[15px] data-[selected=true]:bg-item-hover"
              >
                <ItemContent item={item} />
              </CommandPrimitive.Item>
            ))}
          </CommandPrimitive.Group>
        )}
      </CommandPrimitive.List>
      <p className="border-t border-border bg-rail/60 px-4 py-3 text-xs text-muted-foreground">
        <span className="font-bold text-status-online uppercase">Protip:</span> Start searches with{" "}
        <kbd className="font-semibold text-header">@</kbd> for people,{" "}
        <kbd className="font-semibold text-header">#</kbd> for channels or{" "}
        <kbd className="font-semibold text-header">*</kbd> for servers.
      </p>
    </CommandPrimitive>
  )
}

/** Ctrl/⌘+K: jump to any channel, DM, friend or server. */
export function QuickSwitcher({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden bg-sidebar p-0 sm:max-w-[570px]">
        <DialogTitle className="sr-only">Quick switcher</DialogTitle>
        <DialogDescription className="sr-only">
          Search for a channel, conversation or server and press Enter to go there.
        </DialogDescription>
        {open && <QuickSwitcherBody />}
      </DialogContent>
    </Dialog>
  )
}
