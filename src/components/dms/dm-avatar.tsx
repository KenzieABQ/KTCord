"use client"

import { UsersIcon } from "lucide-react"

import type { Surface } from "@/components/profile/status-dot"
import { fallbackColor, UserAvatar } from "@/components/profile/user-avatar"
import { dmTitle, type DmChannel } from "@/lib/api/dms"
import { useUserId } from "@/lib/stores/auth-store"
import { usePresenceStatus } from "@/lib/stores/presence-store"
import { cn } from "@/lib/utils"

/** The other person's avatar (with presence) for a 1:1 DM, or a group icon. */
export function DmAvatar({
  dm,
  className,
  surface = "sidebar",
  showStatus = true,
}: {
  dm: DmChannel
  className?: string
  surface?: Surface
  showStatus?: boolean
}) {
  const userId = useUserId()
  const other = dm.type === "dm" ? dm.recipients.find((r) => r.user_id !== userId) : undefined
  const status = usePresenceStatus(other?.user_id)

  if (other) {
    return (
      <UserAvatar
        userId={other.user_id}
        name={other.profile.display_name || other.profile.username}
        src={other.profile.avatar_url}
        status={showStatus ? status : undefined}
        surface={surface}
        className={cn("size-8", className)}
      />
    )
  }
  return (
    <span
      className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-white", className)}
      style={{ backgroundColor: fallbackColor(dm.id) }}
      aria-label={dmTitle(dm, userId)}
    >
      <UsersIcon className="size-[55%]" />
    </span>
  )
}
