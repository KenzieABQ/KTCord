"use client"

import { MegaphoneIcon, MessageSquareTextIcon, SearchIcon, UsersIcon } from "@/components/icons"
import { useCallback, useEffect, useRef, useState } from "react"

import { ViewHeader } from "@/components/layout/view-header"
import { ForumView } from "@/components/forum/forum-view"
import { ChannelIcon } from "@/components/servers/channel-icon"
import { VoiceChannelView } from "@/components/voice/voice-channel-view"
import { VoiceTextChat } from "@/components/voice/voice-text-chat"
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
import { FollowDialog } from "./follow-dialog"
import { HeaderButton } from "./header-button"
import { MessageFeed, type MessageFeedHandle } from "./message-feed"
import { SEARCH_HINT } from "./search-panel"
import { ChannelSidePanel, HeaderSearch } from "./side-panel"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

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

function FollowButton({ channel }: { channel: Channel }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <HeaderButton label="Follow" onClick={() => setOpen(true)}>
        <MegaphoneIcon className="size-5" />
      </HeaderButton>
      <FollowDialog channel={channel} open={open} onOpenChange={setOpen} />
    </>
  )
}

function ChannelTitle({ channel }: { channel: Channel }) {
  return (
    <>
      <ChannelIcon type={channel.type} className="size-6 shrink-0 text-muted-foreground" />
      <h1 className="truncate font-semibold text-header">{channel.name}</h1>
      {channel.topic && (
        <>
          <span className="mx-1 hidden h-6 w-px shrink-0 bg-border md:block" />
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="hidden truncate text-sm text-muted-foreground md:block">{channel.topic}</p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-sm">
              {channel.topic}
            </TooltipContent>
          </Tooltip>
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
                {channel.type === "announcement" && <FollowButton channel={channel} />}
                <ChannelPopoverActions />
                <MembersButton />
                <HeaderSearch className="ml-1 hidden lg:block" />
                <MobileSearchButton />
              </>
            }
          >
            <ChannelTitle channel={channel} />
          </ViewHeader>
          <ChannelBody key={channel.id} feed={feed} channel={channel} initialJumpId={initialJumpId} />
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
  if (channel.type === "forum") return <ForumChannel serverId={serverId} channel={channel} />
  if (channel.type !== "voice") {
    // Not keyed: the header and member list stay put between channels; only the body
    // (feed and composer) starts fresh for each channel (see ChannelBody's key).
    return <TextChannel serverId={serverId} channel={channel} initialJumpId={initialJumpId} />
  }

  return <VoiceChannel serverId={serverId} channel={channel} />
}

function ForumChannel({ serverId, channel }: { serverId: string; channel: Channel }) {
  return (
    <div className="flex min-w-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col">
        <ViewHeader actions={<MembersButton />}>
          <ChannelTitle channel={channel} />
        </ViewHeader>
        <ForumView key={channel.id} serverId={serverId} channel={channel} />
      </section>
    </div>
  )
}

function VoiceChannel({ serverId, channel }: { serverId: string; channel: Channel }) {
  const chatOpen = useUiStore((s) => s.voiceChatOpen)
  const setChatOpen = useUiStore((s) => s.setVoiceChatOpen)
  return (
    <div className="flex min-w-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col">
        <ViewHeader
          actions={
            <>
              <HeaderButton label={chatOpen ? "Hide Chat" : "Show Chat"} active={chatOpen} onClick={() => setChatOpen(!chatOpen)}>
                <MessageSquareTextIcon className="size-5" />
              </HeaderButton>
              <MembersButton />
            </>
          }
        >
          <ChannelTitle channel={channel} />
        </ViewHeader>
        <VoiceChannelView serverId={serverId} channel={channel} />
      </section>
      {chatOpen ? <VoiceTextChat serverId={serverId} channel={channel} /> : <MemberPanel serverId={serverId} />}
    </div>
  )
}
