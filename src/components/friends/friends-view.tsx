"use client"

import { CheckIcon, CompassIcon, MessageCircleIcon, MoreVerticalIcon, PlusIcon, SearchIcon, UsersIcon, XIcon } from "@/components/icons"
import { useMemo, useState, type ReactNode } from "react"
import { toast } from "@/lib/toast"

import { KtcordLogo } from "@/components/brand/logo"
import { ViewHeader } from "@/components/layout/view-header"
import { STATUS_LABEL } from "@/components/profile/status-dot"
import { UserAvatar } from "@/components/profile/user-avatar"
import { UserPopover } from "@/components/profile/user-popover"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { errorMessage } from "@/lib/api/errors"
import type { Relationship } from "@/lib/api/friends"
import { activeCustomStatus } from "@/lib/custom-status"
import { rankMatches } from "@/lib/mentions"
import { displayNameOf } from "@/lib/profile-display"
import {
  useOpenDm,
  useRelationships,
  useRemoveFriend,
  useRespondToRequest,
  useSendFriendRequest,
} from "@/lib/queries/social"
import { usePresenceStore } from "@/lib/stores/presence-store"
import { useUiStore } from "@/lib/stores/ui-store"
import { cn } from "@/lib/utils"

type Tab = "online" | "all" | "pending" | "add"

function RoundAction({
  label,
  onClick,
  tone = "default",
  children,
}: {
  label: string
  onClick: () => void
  tone?: "default" | "accept" | "deny"
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
          className={cn(
            "flex size-9 items-center justify-center rounded-full bg-sidebar text-interactive transition-colors",
            tone === "default" && "hover:text-interactive-hover",
            tone === "accept" && "hover:text-success",
            tone === "deny" && "hover:text-mention"
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

function FriendRow({
  relationship,
  onRemove,
}: {
  relationship: Relationship
  onRemove: (r: Relationship) => void
}) {
  const status = usePresenceStore((s) => s.byUser[relationship.user.id])
  const openDm = useOpenDm()
  const respond = useRespondToRequest()
  const remove = useRemoveFriend()
  const user = relationship.user
  const name = displayNameOf(user)
  const custom = activeCustomStatus(user)
  const onError = (e: unknown) => toast.error(errorMessage(e))

  const subtitle =
    relationship.kind === "incoming"
      ? "Incoming Friend Request"
      : relationship.kind === "outgoing"
        ? "Outgoing Friend Request"
        : custom && status
          ? [custom.emoji, custom.text].filter(Boolean).join(" ")
          : STATUS_LABEL[status ?? "offline"]

  return (
    <li className="group -mx-2 flex items-center gap-3 rounded-lg border-t border-border px-2 py-2.5 first:border-t-0 hover:border-transparent hover:bg-item-hover [&:hover+li]:border-transparent">
      <UserPopover userId={user.id} side="right">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <UserAvatar
            userId={user.id}
            name={name}
            src={user.avatar_url}
            status={relationship.kind === "friend" ? (status ?? "offline") : undefined}
            surface="chat"
            className="size-8"
          />
          <span className="min-w-0">
            <span className="flex items-baseline gap-1.5">
              <span className="truncate font-semibold text-header">{name}</span>
              <span className="hidden truncate text-sm text-muted-foreground group-hover:inline">{user.username}</span>
            </span>
            <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
          </span>
        </button>
      </UserPopover>
      <div className="flex shrink-0 gap-2">
        {relationship.kind === "friend" && (
          <>
            <RoundAction label="Message" onClick={() => openDm.mutate(user.id, { onError })}>
              <MessageCircleIcon className="size-4" />
            </RoundAction>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger
                    aria-label="More"
                    className="flex size-9 items-center justify-center rounded-full bg-sidebar text-interactive outline-none focus-visible:ring-2 focus-visible:ring-ring hover:text-interactive-hover"
                  >
                    <MoreVerticalIcon className="size-4" />
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top">More</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="">
                <DropdownMenuItem variant="destructive" onSelect={() => onRemove(relationship)}>
                  Remove Friend
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        {relationship.kind === "incoming" && (
          <>
            <RoundAction
              label="Accept"
              tone="accept"
              onClick={() => respond.mutate({ requestId: relationship.id, accept: true }, { onError })}
            >
              <CheckIcon className="size-4" />
            </RoundAction>
            <RoundAction
              label="Ignore"
              tone="deny"
              onClick={() => respond.mutate({ requestId: relationship.id, accept: false }, { onError })}
            >
              <XIcon className="size-4" />
            </RoundAction>
          </>
        )}
        {relationship.kind === "outgoing" && (
          <RoundAction label="Cancel" tone="deny" onClick={() => remove.mutate(user.id, { onError })}>
            <XIcon className="size-4" />
          </RoundAction>
        )}
      </div>
    </li>
  )
}

function AddFriend() {
  const send = useSendFriendRequest()
  const [username, setUsername] = useState("")
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const target = username.trim().replace(/^@/, "")
    if (!target) return
    try {
      const friendship = await send.mutateAsync(target)
      setResult({
        ok: true,
        text:
          friendship.status === "accepted"
            ? `You're now friends with ${target}!`
            : `Success! Your friend request to ${target} was sent.`,
      })
      setUsername("")
    } catch (error) {
      setResult({ ok: false, text: errorMessage(error) })
    }
  }

  return (
    <section className="border-b border-border px-6 py-5">
      <h2 className="text-base font-semibold text-header uppercase">Add Friend</h2>
      <p className="mt-1 text-sm text-muted-foreground">You can add friends with their KTCord username.</p>
      <form
        onSubmit={submit}
        className={cn(
          "mt-4 flex items-center gap-2 rounded-lg border bg-rail px-3 py-1.5 focus-within:border-link",
          result ? (result.ok ? "border-success" : "border-mention") : "border-transparent"
        )}
      >
        <input
          autoFocus
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            setResult(null)
          }}
          placeholder="You can add friends with their KTCord username."
          aria-label="Username"
          autoCapitalize="none"
          spellCheck={false}
          className="h-9 min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" size="sm" disabled={!username.trim() || send.isPending}>
          Send Friend Request
        </Button>
      </form>
      {result && (
        <p className={cn("mt-2 text-sm", result.ok ? "text-success" : "text-mention")} role="status">
          {result.text}
        </p>
      )}
    </section>
  )
}

/** Shown when you have no friends yet: the branded welcome with first steps. */
function Welcome({ onAddFriend }: { onAddFriend: () => void }) {
  const openDialog = useUiStore((s) => s.openDialog)
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-6 px-4 py-12 text-center">
      <KtcordLogo className="text-4xl" markClassName="size-14" />
      <div>
        <h2 className="text-2xl font-bold text-header">Welcome to KTCord!</h2>
        <p className="mt-2 text-muted-foreground">
          It&apos;s a little quiet here. Add a friend by their username, or start or join a server.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onAddFriend}>
          <PlusIcon /> Add Friend
        </Button>
        <Button variant="secondary" onClick={() => openDialog({ kind: "create-server" })}>
          <UsersIcon /> Create a Server
        </Button>
        <Button variant="secondary" onClick={() => openDialog({ kind: "join-server" })}>
          <CompassIcon /> Join a Server
        </Button>
      </div>
    </div>
  )
}

function ActiveNow({ friends }: { friends: Relationship[] }) {
  const presence = usePresenceStore((s) => s.byUser)
  const online = friends.filter((r) => presence[r.user.id])
  return (
    <aside className="hidden w-[340px] shrink-0 flex-col border-l border-border p-4 xl:flex">
      <h2 className="text-xl font-bold text-header">Active Now</h2>
      {online.length === 0 ? (
        <div className="mt-4 p-4 text-center">
          <p className="font-semibold text-header">It&apos;s quiet for now...</p>
          <p className="mt-1 text-sm text-muted-foreground">
            When friends come online or start chatting in a voice channel, we&apos;ll show it here!
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {online.map((r) => (
            <li key={r.user.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <UserAvatar
                userId={r.user.id}
                name={displayNameOf(r.user)}
                src={r.user.avatar_url}
                status={presence[r.user.id]}
                surface="chat"
                className="size-8"
              />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-header">{displayNameOf(r.user)}</span>
                <span className="block truncate text-xs text-muted-foreground">{STATUS_LABEL[presence[r.user.id]]}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

/** Home → Friends: Online, All, Pending, Add Friend. */
export function FriendsView() {
  const { data: relationships, isPending } = useRelationships()
  const presence = usePresenceStore((s) => s.byUser)
  const remove = useRemoveFriend()
  const [tab, setTab] = useState<Tab>("online")
  const [search, setSearch] = useState("")
  const [removing, setRemoving] = useState<Relationship | null>(null)

  const friends = useMemo(() => (relationships ?? []).filter((r) => r.kind === "friend"), [relationships])
  const pending = useMemo(() => (relationships ?? []).filter((r) => r.kind !== "friend"), [relationships])
  const incoming = pending.filter((r) => r.kind === "incoming").length

  const list = tab === "online" ? friends.filter((r) => presence[r.user.id]) : tab === "all" ? friends : pending
  const filtered = rankMatches(list, search, (r) => [r.user.username, displayNameOf(r.user)], 500)
  const heading = { online: "Online", all: "All friends", pending: "Pending", add: "" }[tab]

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "online", label: "Online" },
    { id: "all", label: "All" },
    { id: "pending", label: "Pending", badge: incoming },
  ]

  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <ViewHeader>
          <UsersIcon className="size-5 shrink-0 text-muted-foreground" />
          <h1 className="shrink-0 font-semibold text-header">Friends</h1>
          <span className="mx-2 hidden h-6 w-px bg-border sm:block" />
          <nav className="scrollbar-none flex items-center gap-1 overflow-x-auto" aria-label="Friends">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-[15px] font-medium",
                  tab === t.id ? "bg-item-selected text-interactive-active" : "text-interactive hover:bg-item-hover hover:text-interactive-hover"
                )}
              >
                {t.label}
                {Boolean(t.badge) && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-mention px-1 text-[11px] font-bold text-white">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTab("add")}
              className={cn(
                "shrink-0 rounded-md px-2 py-0.5 text-[15px] font-medium",
                tab === "add" ? "bg-transparent text-success" : "bg-success text-white"
              )}
            >
              Add Friend
            </button>
          </nav>
        </ViewHeader>

        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {tab === "add" && <AddFriend />}
          {tab !== "add" &&
            (isPending ? (
              <div className="flex flex-col gap-4 p-6">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-8 rounded-full bg-item-selected/60" />
                    <Skeleton className="h-4 w-40 bg-item-selected/60" />
                  </div>
                ))}
              </div>
            ) : (relationships ?? []).length === 0 ? (
              <Welcome onAddFriend={() => setTab("add")} />
            ) : (
              <div className="px-6 pt-4">
                <div className="relative">
                  <Input
                    placeholder="Search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 bg-rail pr-8"
                    aria-label="Search friends"
                  />
                  <SearchIcon className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                <h2 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {heading} — {filtered.length}
                </h2>
                {filtered.length === 0 ? (
                  <p className="py-16 text-center text-muted-foreground">
                    {tab === "pending"
                      ? "There are no pending friend requests. Here's a quiet spot for now."
                      : tab === "online"
                        ? "No one's around to chat with right now."
                        : "No friends match that search."}
                  </p>
                ) : (
                  <ul>
                    {filtered.map((r) => (
                      <FriendRow key={r.id} relationship={r} onRemove={setRemoving} />
                    ))}
                  </ul>
                )}
              </div>
            ))}
        </div>
      </div>

      <ActiveNow friends={friends} />

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent className="bg-chat">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove &apos;{removing ? displayNameOf(removing.user) : ""}&apos;</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {removing ? displayNameOf(removing.user) : "them"} from your friends?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/80"
              onClick={() => {
                if (removing) remove.mutate(removing.user.id, { onError: (e) => toast.error(errorMessage(e)) })
                setRemoving(null)
              }}
            >
              Remove Friend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
