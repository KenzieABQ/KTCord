import { AnimatedImage, isAnimated } from "@/components/ui/animated-image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initialsOf } from "@/lib/profile-display"
import { cn } from "@/lib/utils"

import { StatusDot, type PresenceStatus, type Surface } from "./status-dot"

const FALLBACK_COLORS = ["#5865f2", "#3ba55c", "#faa61a", "#ed4245", "#eb459e", "#9b59b6"]

/** A stable color per user for avatars without an image. */
export function fallbackColor(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length]
}

export function UserAvatar({
  userId,
  name,
  src,
  status,
  surface,
  className,
  statusClassName,
  animate = "hover",
}: {
  userId: string
  name: string
  src?: string | null
  status?: PresenceStatus
  surface?: Surface
  className?: string
  statusClassName?: string
  /** GIF avatars: play on hover (default, as in lists) or always (profile cards). */
  animate?: "hover" | "always"
}) {
  const animated = isAnimated(src)
  return (
    <div className={cn("@container relative size-8 shrink-0", className)}>
      <Avatar className="size-full after:hidden">
        {src && !animated && <AvatarImage src={src} alt="" />}
        <AvatarFallback
          className="font-semibold text-white"
          style={{ backgroundColor: fallbackColor(userId) }}
        >
          <span className="text-[38cqw] leading-none">{initialsOf(name)}</span>
        </AvatarFallback>
      </Avatar>
      {src && animated && (
        <span className="absolute inset-0 overflow-hidden rounded-full">
          <AnimatedImage src={src} animate={animate} />
        </span>
      )}
      {status && (
        <StatusDot
          status={status}
          surface={surface}
          className={cn("absolute -right-0.5 -bottom-0.5", statusClassName)}
        />
      )}
    </div>
  )
}
