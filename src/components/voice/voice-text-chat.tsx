"use client"

import { MessageSquareTextIcon, XIcon } from "@/components/icons"
import { useCallback, useRef } from "react"

import { ChannelWelcome } from "@/components/chat/channel-welcome"
import { ChatProvider } from "@/components/chat/chat-context"
import { Composer } from "@/components/chat/composer"
import { MessageFeed, type MessageFeedHandle } from "@/components/chat/message-feed"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useBreakpoint } from "@/hooks/use-breakpoint"
import type { Channel } from "@/lib/api/channels"
import { useUiStore } from "@/lib/stores/ui-store"

/** A voice channel's own text chat ("text in voice"), beside the call. */
export function VoiceTextChat({ serverId, channel }: { serverId: string; channel: Channel }) {
  const breakpoint = useBreakpoint()
  const close = useUiStore((s) => s.setVoiceChatOpen)
  const feed = useRef<MessageFeedHandle>(null)
  const jumpToMessage = useCallback((id: string) => feed.current?.jumpToMessage(id), [])

  const content = (
    <div className="flex h-full min-w-0 flex-col bg-chat">
      <header className="flex h-12 shrink-0 items-center gap-2 px-4 border-b border-border">
        <MessageSquareTextIcon className="size-5 shrink-0 text-muted-foreground" />
        <h2 className="min-w-0 flex-1 truncate font-semibold text-header">{channel.name}</h2>
        <button
          type="button"
          aria-label="Close chat"
          onClick={() => close(false)}
          className="flex size-8 items-center justify-center rounded-md text-interactive hover:text-interactive-hover"
        >
          <XIcon className="size-5" />
        </button>
      </header>
      <ChatProvider key={channel.id} serverId={serverId} channel={channel} jumpToMessage={jumpToMessage}>
        <MessageFeed ref={feed} channel={channel} welcome={<ChannelWelcome channel={channel} />} />
        <Composer onSent={() => feed.current?.scrollToBottom()} />
      </ChatProvider>
    </div>
  )

  if (breakpoint === "desktop") {
    return (
      <aside aria-label="Voice channel chat" className="w-[400px] shrink-0 border-l border-border">
        {content}
      </aside>
    )
  }
  return (
    <Sheet open onOpenChange={(open) => !open && close(false)}>
      <SheetContent side="right" showCloseButton={false} className="w-full max-w-full gap-0 border-0 p-0 sm:max-w-[480px]">
        <SheetTitle className="sr-only">Voice channel chat</SheetTitle>
        {content}
      </SheetContent>
    </Sheet>
  )
}
