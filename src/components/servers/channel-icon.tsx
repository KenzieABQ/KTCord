import { HashIcon, MegaphoneIcon, MessagesSquareIcon, Volume2Icon } from "@/components/icons"

import type { Channel } from "@/lib/api/channels"

/** The icon Discord shows for each kind of server channel. */
export function ChannelIcon({ type, className }: { type: Channel["type"]; className?: string }) {
  switch (type) {
    case "voice":
      return <Volume2Icon className={className} />
    case "announcement":
      return <MegaphoneIcon className={className} />
    case "forum":
      return <MessagesSquareIcon className={className} />
    default:
      return <HashIcon className={className} />
  }
}

/** Channel types whose names are lowercase-with-dashes, like text channels. */
export const isTextLike = (type: Channel["type"]) => type === "text" || type === "announcement" || type === "forum"
