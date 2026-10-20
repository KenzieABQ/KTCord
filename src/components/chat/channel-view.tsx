"use client"

import { HashIcon, MessagesSquareIcon, PinIcon, SearchIcon, UsersIcon, Volume2Icon } from "lucide-react"
import { useCallback, useRef } from "react"

import { ViewHeader } from "@/components/layout/view-header"
import { MemberPanel, useToggleMembers } from "@/components/members/member-panel"
import { useBreakpoint } from "@/hooks/use-breakpoint"
import { useSwipe } from "@/hooks/use-swipe"
import type { Channel } from "@/lib/api/channels"
import { useUiStore } from "@/lib/stores/ui-store"

import { ChatProvider } from "./chat-context"
import { Composer } from "./composer"
import { HeaderButton } from "./header-button"
import { MessageFeed, type MessageFeedHandle } from "./message-feed"

function ChannelHeader({ channel }: { channel: Channel }) {
  const members = useToggleMembers()
  const isVoice = channel.type === "voice"
  const Icon = isVoice ? Volume2Icon : HashIcon

  return (
    <ViewHeader
      actions={
        <>
          {!isVoice && (
            <>
              <HeaderButton label="Threads" disabled className="hidden sm:flex">
                <MessagesSquareIcon className="size-5" />
              </HeaderButton>
              <HeaderButton label="Pinned Messages" disabled className="hidden sm:flex">
                <PinIcon className="size-5" />
              </HeaderButton>
            </>
          )}
          <HeaderButton
            label={members.active ? "Hide Member List" : "Show Member List"}
            active={members.active}
            onClick={members.toggle}
          >
            <UsersIcon className="size-5" />
          </HeaderButton>
          {!isVoice && (
            <div className="ml-1 hidden h-6 w-36 items-center gap-1 rounded-sm bg-rail px-1.5 text-sm text-muted-foreground lg:flex">
              <span className="flex-1 truncate">Search</span>
              <SearchIcon className="size-4" />
            </div>
          )}
        </>
      }
    >
      <Icon className="size-6 shrink-0 text-muted-foreground" />
      <h1 className="truncate font-semibold text-header">{channel.name}</h1>
      {channel.topic && (
        <>
          <span className="mx-1 hidden h-6 w-px shrink-0 bg-border md:block" />
          <p className="hidden truncate text-sm text-muted-foreground md:block" title={channel.topic}>
            {channel.topic}
          </p>
        </>
      )}
    </ViewHeader>
  )
}

function TextChannelBody({
  serverId,
  channel,
  initialJumpId,
}: {
  serverId: string
  channel: Channel
  initialJumpId?: string
}) {
  const feed = useRef<MessageFeedHandle>(null)
  const jumpToMessage = useCallback((id: string) => feed.current?.jumpToMessage(id), [])

  return (
    <ChatProvider serverId={serverId} channel={channel} jumpToMessage={jumpToMessage}>
      <MessageFeed ref={feed} channel={channel} initialJumpId={initialJumpId} />
      <Composer onSent={() => feed.current?.scrollToBottom()} />
    </ChatProvider>
  )
}

export function ChannelView({
  serverId,
  channel,
  initialJumpId,
}: {
  serverId: string
  channel: Channel
  initialJumpId?: string
}) {
  const breakpoint = useBreakpoint()
  const setMemberSheetOpen = useUiStore((s) => s.setMemberSheetOpen)
  const sectionRef = useRef<HTMLElement>(null)
  useSwipe(sectionRef, { onSwipeLeft: () => setMemberSheetOpen(true) }, breakpoint === "mobile")

  return (
    <div className="flex min-w-0 flex-1">
      <section ref={sectionRef} className="flex min-w-0 flex-1 flex-col">
        <ChannelHeader channel={channel} />
        {channel.type === "voice" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-rail p-6 text-center">
            <Volume2Icon className="size-12 text-muted-foreground" />
            <h2 className="text-2xl font-bold text-header">{channel.name}</h2>
            <p className="max-w-sm text-muted-foreground">
              Voice channels come online in a later milestone. For now this is where the
              people connected here will show up.
            </p>
          </div>
        ) : (
          // Keyed so each channel gets a fresh feed (scroll position, unread divider).
          <TextChannelBody
            key={channel.id}
            serverId={serverId}
            channel={channel}
            initialJumpId={initialJumpId}
          />
        )}
      </section>
      <MemberPanel serverId={serverId} />
    </div>
  )
}
