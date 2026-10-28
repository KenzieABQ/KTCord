import { ChannelIcon } from "@/components/servers/channel-icon"
import type { Channel } from "@/lib/api/channels"

/** "This is the beginning of #channel", shown above the oldest message. */
export function ChannelWelcome({ channel }: { channel: Channel }) {
  const prefix = channel.type === "voice" ? "" : "#"
  return (
    <div className="px-4 pt-16 pb-4">
      <div className="flex size-[68px] items-center justify-center rounded-full bg-secondary">
        <ChannelIcon type={channel.type} className="size-10 text-white" />
      </div>
      <h2 className="mt-2 text-3xl font-bold text-header">
        Welcome to {prefix}
        {channel.name}!
      </h2>
      <p className="mt-1 text-muted-foreground">
        This is the beginning of the {prefix}
        {channel.name} channel.
      </p>
    </div>
  )
}
