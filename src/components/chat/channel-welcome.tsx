import { HashIcon } from "lucide-react"

import type { Channel } from "@/lib/api/channels"

/** "This is the beginning of #channel", shown above the oldest message. */
export function ChannelWelcome({ channel }: { channel: Channel }) {
  return (
    <div className="px-4 pt-16 pb-4">
      <div className="flex size-[68px] items-center justify-center rounded-full bg-secondary">
        <HashIcon className="size-10 text-white" />
      </div>
      <h2 className="mt-2 text-3xl font-bold text-header">Welcome to #{channel.name}!</h2>
      <p className="mt-1 text-muted-foreground">This is the beginning of the #{channel.name} channel.</p>
    </div>
  )
}
