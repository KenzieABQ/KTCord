"use client"

import { useChat } from "./chat-context"
import { PinsPopover, ThreadsPopover } from "./channel-popovers"

/** Threads (server text channels only) and Pins header buttons. */
export function ChannelPopoverActions() {
  const { serverId, channel } = useChat()
  return (
    <>
      {serverId && channel.type === "text" && (
        <span className="hidden sm:contents">
          <ThreadsPopover />
        </span>
      )}
      <PinsPopover />
    </>
  )
}
