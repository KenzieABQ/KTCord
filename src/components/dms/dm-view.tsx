"use client"

import { CrownIcon, LogOutIcon, UserPlusIcon, UsersIcon, UserSquareIcon } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { PinsPopover } from "@/components/chat/channel-popovers"
import { MobileSearchButton } from "@/components/chat/channel-view"
import { DmChatProvider } from "@/components/chat/chat-context"
import { Composer } from "@/components/chat/composer"
import { HeaderButton } from "@/components/chat/header-button"
import { ChatDropZone } from "@/components/chat/drop-zone"
import { MessageFeed, type MessageFeedHandle } from "@/components/chat/message-feed"
import { ChannelSidePanel, HeaderSearch } from "@/components/chat/side-panel"
import { MessageFeedSkeleton } from "@/components/layout/skeletons"
import { ViewHeader } from "@/components/layout/view-header"
import { ProfileCard } from "@/components/profile/profile-card"
import { STATUS_LABEL } from "@/components/profile/status-dot"
import { UserAvatar } from "@/components/profile/user-avatar"
import { UserPopover } from "@/components/profile/user-popover"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useBreakpoint } from "@/hooks/use-breakpoint"
import { dmTitle, type DmChannel } from "@/lib/api/dms"
import { errorMessage } from "@/lib/api/errors"
import { activeCustomStatus } from "@/lib/custom-status"
import { displayNameOf } from "@/lib/profile-display"
import { useDm, useDms, useLeaveGroupDm, useRenameGroupDm } from "@/lib/queries/social"
import { useUserId } from "@/lib/stores/auth-store"
import { usePresenceStatus, usePresenceStore } from "@/lib/stores/presence-store"
import { useUiStore } from "@/lib/stores/ui-store"

import { DmAvatar } from "./dm-avatar"

function GroupName({ dm }: { dm: DmChannel }) {
  const userId = useUserId()
  const rename = useRenameGroupDm()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(dm.name ?? "")
  const title = dmTitle(dm, userId)

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(dm.name ?? "")
          setEditing(true)
        }}
        title="Rename group"
        className="truncate rounded px-1 font-semibold text-header hover:bg-rail"
      >
        {title}
      </button>
    )
  }
  return (
    <input
      autoFocus
      value={value}
      maxLength={100}
      placeholder={title}
      aria-label="Group name"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setEditing(false)
        if (e.key === "Enter") {
          rename.mutate({ channelId: dm.id, name: value }, { onError: (err) => toast.error(errorMessage(err)) })
          setEditing(false)
        }
      }}
      className="h-7 min-w-0 rounded bg-rail px-1 font-semibold text-header outline-none"
    />
  )
}

function DmWelcome({ dm }: { dm: DmChannel }) {
  const userId = useUserId()
  const title = dmTitle(dm, userId)
  const other = dm.type === "dm" ? dm.recipients.find((r) => r.user_id !== userId) : undefined
  return (
    <div className="px-4 pt-16 pb-4">
      <DmAvatar dm={dm} className="size-20" showStatus={false} />
      <h2 className="mt-3 text-3xl font-bold text-header">{title}</h2>
      {other && <p className="text-lg text-header">{other.profile.username}</p>}
      <p className="mt-2 text-muted-foreground">
        {other ? (
          <>
            This is the beginning of your direct message history with <strong>@{title}</strong>.
          </>
        ) : (
          <>
            Welcome to the beginning of the <strong>{title}</strong> group.
          </>
        )}
      </p>
    </div>
  )
}

/** Right panel: the other person's profile (1:1) or the group's members. */
function DmSidePanel({ dm }: { dm: DmChannel }) {
  const userId = useUserId()
  const presence = usePresenceStore((s) => s.byUser)
  const leave = useLeaveGroupDm()
  const other = dm.type === "dm" ? dm.recipients.find((r) => r.user_id !== userId) : undefined
  const otherStatus = usePresenceStatus(other?.user_id)

  if (other) {
    const custom = activeCustomStatus(other.profile)
    return (
      <div className="h-full overflow-y-auto">
        <ProfileCard
          className="rounded-none shadow-none"
          status={otherStatus}
          profile={{
            id: other.user_id,
            username: other.profile.username,
            displayName: displayNameOf(other.profile),
            avatarUrl: other.profile.avatar_url,
            bannerColor: other.profile.banner_color,
            bio: other.profile.bio,
            createdAt: other.profile.created_at,
            customStatus: custom ? [custom.emoji, custom.text].filter(Boolean).join(" ") : null,
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <h3 className="px-4 pt-6 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Members — {dm.recipients.length}
      </h3>
      <ul className="flex-1 overflow-y-auto px-2">
        {dm.recipients.map((r) => (
          <li key={r.user_id}>
            <UserPopover userId={r.user_id} side="left">
              <button type="button" className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-item-hover">
                <UserAvatar
                  userId={r.user_id}
                  name={displayNameOf(r.profile)}
                  src={r.profile.avatar_url}
                  status={presence[r.user_id] ?? "offline"}
                  className="size-8"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-header">
                    {displayNameOf(r.profile)}
                    {r.user_id === dm.owner_id && (
                      <CrownIcon className="ml-1 inline size-3.5 text-status-idle" aria-label="Group Owner" />
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {STATUS_LABEL[presence[r.user_id] ?? "offline"]}
                  </span>
                </span>
              </button>
            </UserPopover>
          </li>
        ))}
      </ul>
      <div className="p-3">
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => {
            if (window.confirm(`Leave ${dmTitle(dm, userId)}? You won't be able to rejoin unless re-added.`)) {
              leave.mutate(dm.id, { onError: (e) => toast.error(errorMessage(e)) })
            }
          }}
        >
          <LogOutIcon /> Leave Group
        </Button>
      </div>
    </div>
  )
}

function DmView({ dm, initialJumpId }: { dm: DmChannel; initialJumpId?: string }) {
  const userId = useUserId()
  const breakpoint = useBreakpoint()
  const openDialog = useUiStore((s) => s.openDialog)
  const panelVisible = useUiStore((s) => s.memberListVisible)
  const toggleMemberList = useUiStore((s) => s.toggleMemberList)
  const sheetOpen = useUiStore((s) => s.memberSheetOpen)
  const setSheetOpen = useUiStore((s) => s.setMemberSheetOpen)
  const feed = useRef<MessageFeedHandle>(null)
  const jumpToMessage = useCallback((id: string) => feed.current?.jumpToMessage(id), [])
  const isGroup = dm.type === "group_dm"
  const other = !isGroup ? dm.recipients.find((r) => r.user_id !== userId) : undefined
  const otherStatus = usePresenceStatus(other?.user_id)
  const desktop = breakpoint === "desktop"

  const profilePanel = desktop ? (
    panelVisible && (
      <aside aria-label="Conversation details" className="w-[340px] shrink-0 border-l border-border bg-sidebar">
        <DmSidePanel dm={dm} />
      </aside>
    )
  ) : (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetContent side="right" className="w-80 max-w-[90vw] gap-0 border-0 bg-sidebar p-0 sm:max-w-80">
        <SheetTitle className="sr-only">{isGroup ? "Members" : "Profile"}</SheetTitle>
        <DmSidePanel dm={dm} />
      </SheetContent>
    </Sheet>
  )

  return (
    <DmChatProvider key={dm.id} dm={dm} jumpToMessage={jumpToMessage}>
      <div className="flex min-w-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col">
          <ViewHeader
            actions={
              <>
                <PinsPopover />
                <HeaderButton
                  label={isGroup ? "Add Friends to DM" : "Start a Group DM"}
                  onClick={() =>
                    openDialog(
                      isGroup
                        ? { kind: "create-dm", addToChannelId: dm.id }
                        : { kind: "create-dm", preselect: other ? [other.user_id] : [] }
                    )
                  }
                >
                  <UserPlusIcon className="size-5" />
                </HeaderButton>
                <HeaderButton
                  label={isGroup ? "Show Member List" : "Show User Profile"}
                  active={desktop && panelVisible}
                  onClick={() => (desktop ? toggleMemberList() : setSheetOpen(true))}
                >
                  {isGroup ? <UsersIcon className="size-5" /> : <UserSquareIcon className="size-5" />}
                </HeaderButton>
                <HeaderSearch className="ml-1 hidden lg:block" />
                <MobileSearchButton />
              </>
            }
          >
            <DmAvatar dm={dm} className="size-6" surface="chat" />
            {isGroup ? (
              <GroupName dm={dm} />
            ) : (
              <>
                <h1 className="truncate font-semibold text-header">{dmTitle(dm, userId)}</h1>
                <span className="hidden text-sm text-muted-foreground sm:inline">{STATUS_LABEL[otherStatus]}</span>
              </>
            )}
          </ViewHeader>
          <ChatDropZone channelId={dm.id} label={isGroup ? dmTitle(dm, userId) : `@${dmTitle(dm, userId)}`} enabled className="flex min-h-0 flex-1 flex-col">
            <MessageFeed ref={feed} channel={dm} welcome={<DmWelcome dm={dm} />} initialJumpId={initialJumpId} />
            <Composer onSent={() => feed.current?.scrollToBottom()} />
          </ChatDropZone>
        </section>
        <ChannelSidePanel fallback={profilePanel} />
      </div>
    </DmChatProvider>
  )
}

/** /channels/me/[channelId]: a DM, or back to Friends if it's gone. */
export function DmRoute() {
  const { channelId, messageId } = useParams<{ channelId: string; messageId?: string[] }>()
  const router = useRouter()
  const { isPending } = useDms()
  const { data: dm } = useDm(channelId)

  useEffect(() => {
    if (!isPending && !dm) router.replace("/channels/me")
  }, [isPending, dm, router])

  if (!dm) {
    return (
      <div className="flex min-w-0 flex-1 flex-col">
        <ViewHeader>
          <span className="h-4 w-32 animate-pulse rounded bg-item-selected/60" />
        </ViewHeader>
        <div className="flex flex-1 flex-col justify-end">
          <MessageFeedSkeleton />
        </div>
      </div>
    )
  }
  return <DmView key={dm.id} dm={dm} initialJumpId={messageId?.[0]} />
}
