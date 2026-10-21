"use client"

import { HashIcon, SearchIcon, UsersIcon, Volume2Icon } from "lucide-react"
import { useCallback, useEffect, useRef } from "react"

import { ViewHeader } from "@/components/layout/view-header"
import { VoiceChannelView } from "@/components/voice/voice-channel-view"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { MemberPanel, useToggleMembers } from "@/components/members/member-panel"
import { useBreakpoint } from "@/hooks/use-breakpoint"
import { useSwipe } from "@/hooks/use-swipe"
import type { Channel } from "@/lib/api/channels"
import { useUiStore } from "@/lib/stores/ui-store"

import { ChannelPopoverActions } from "./channel-actions"
import { ChannelWelcome } from "./channel-welcome"
import { ChatProvider, useChat } from "./chat-context"
import { Composer } from "./composer"
import { ChatDropZone } from "./drop-zone"
import { HeaderButton } from "./header-button"
import { MessageFeed, type MessageFeedHandle } from "./message-feed"
import { SEARCH_HINT } from "./search-panel"
import { ChannelSidePanel, HeaderSearch } from "./side-panel"

function MembersButton() {
  const members = useToggleMembers()
  return (
    <HeaderButton
      label={members.active ? "Hide Member List" : "Show Member List"}
      active={members.active}
      onClick={members.toggle}
    >
      <UsersIcon className="size-5" />
    </HeaderButton>
  )
}

function ChannelTitle({ channel }: { channel: Channel }) {
  const Icon = channel.type === "voice" ? Volume2Icon : HashIcon
  return (
    <>
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
    </>
  )
}

/** Below desktop width the search box lives in a popover behind a search button. */
export function MobileSearchButton() {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Search"
        className="flex size-8 items-center justify-center rounded-md text-interactive hover:text-interactive-hover lg:hidden"
      >
        <SearchIcon className="size-5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 bg-floating p-2">
        <HeaderSearch className="[&_input]:h-8 [&_input]:w-full [&_input]:focus:w-full" />
        <p className="mt-1.5 px-1 text-xs text-muted-foreground">{SEARCH_HINT}</p>
      </PopoverContent>
    </Popover>
  )
}

/** A text channel: header with threads/pins/search, the feed, the composer, and the right panel. */
function TextChannel({
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
  const breakpoint = useBreakpoint()
  const setMemberSheetOpen = useUiStore((s) => s.setMemberSheetOpen)
  const closeSidePanel = useUiStore((s) => s.closeSidePanel)
  const sectionRef = useRef<HTMLElement>(null)
  useSwipe(sectionRef, { onSwipeLeft: () => setMemberSheetOpen(true) }, breakpoint === "mobile")

  // A thread panel belongs to its channel; close it when switching channels.
  useEffect(() => {
    const panel = useUiStore.getState().sidePanel
    if (panel?.kind === "thread" && panel.channelId !== channel.id) closeSidePanel()
  }, [channel.id, closeSidePanel])

  return (
    <ChatProvider serverId={serverId} channel={channel} jumpToMessage={jumpToMessage}>
      <div className="flex min-w-0 flex-1">
        <section ref={sectionRef} className="flex min-w-0 flex-1 flex-col">
          <ViewHeader
            actions={
              <>
                <ChannelPopoverActions />
                <MembersButton />
                <HeaderSearch className="ml-1 hidden lg:block" />
                <MobileSearchButton />
              </>
            }
          >
            <ChannelTitle channel={channel} />
          </ViewHeader>
          <ChannelBody feed={feed} channel={channel} initialJumpId={initialJumpId} />
        </section>
        <ChannelSidePanel fallback={<MemberPanel serverId={serverId} />} />
      </div>
    </ChatProvider>
  )
}

function ChannelBody({
  feed,
  channel,
  initialJumpId,
}: {
  feed: React.RefObject<MessageFeedHandle | null>
  channel: Channel
  initialJumpId?: string
}) {
  const { canAttach } = useChat()
  return (
    <ChatDropZone channelId={channel.id} label={`#${channel.name}`} enabled={canAttach} className="flex min-h-0 flex-1 flex-col">
      <MessageFeed ref={feed} channel={channel} welcome={<ChannelWelcome channel={channel} />} initialJumpId={initialJumpId} />
      <Composer onSent={() => feed.current?.scrollToBottom()} />
    </ChatDropZone>
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
  if (channel.type !== "voice") {
    // Keyed so each channel gets a fresh feed (scroll position, unread divider).
    return <TextChannel key={channel.id} serverId={serverId} channel={channel} initialJumpId={initialJumpId} />
  }

  return (
    <div className="flex min-w-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col">
        <ViewHeader actions={<MembersButton />}>
          <ChannelTitle channel={channel} />
        </ViewHeader>
        <VoiceChannelView serverId={serverId} channel={channel} />
      </section>
      <MemberPanel serverId={serverId} />
    </div>
  )
}
