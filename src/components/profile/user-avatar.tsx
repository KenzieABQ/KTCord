import { AnimatedImage, isAnimated } from "@/components/ui/animated-image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Decoration } from "@/lib/cosmetics"
import { initialsOf } from "@/lib/profile-display"
import { cn } from "@/lib/utils"

import { AvatarDecoration } from "./cosmetics"
import { StatusDot, SURFACE_COLOR, type PresenceStatus, type Surface } from "./status-dot"

const FALLBACK_COLORS = ["#5865f2", "#3ba55c", "#faa61a", "#ed4245", "#eb459e", "#9b59b6"]

/** A stable color per user for avatars without an image. */
export function fallbackColor(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length]
}

/** Status dot sizes: its diameter, the outline around it, and how far it sits past the edge. */
const DOT = {
  md: { size: 14, gap: 3, offset: -2 },
  lg: { size: 20, gap: 5, offset: 2 },
} as const

export function UserAvatar({
  userId,
  name,
  src,
  status,
  className,
  statusSize = "md",
  animate = "hover",
  surface,
  ringColor,
  decoration,
}: {
  userId: string
  name: string
  src?: string | null
  status?: PresenceStatus
  /** What the avatar sits on: the status dot's outline takes that color. */
  surface?: Surface
  /** An exact outline color instead (a themed profile card). */
  ringColor?: string
  className?: string
  statusSize?: keyof typeof DOT
  /** GIF avatars and decorations: play on hover (default, as in lists) or always (profile cards). */
  animate?: "hover" | "always"
  /** An avatar decoration from the user's cosmetics. */
  decoration?: Decoration | null
}) {
  const animated = isAnimated(src)
  const dot = DOT[statusSize]
  // With a status, the avatar gets a transparent hole where the dot sits, as in Discord.
  const center = `calc(100% - ${dot.offset + dot.size / 2}px)`
  const hole = dot.size / 2 + dot.gap
  const cutout = status
    ? `radial-gradient(circle at ${center} ${center}, transparent ${hole}px, #000 ${hole + 0.5}px)`
    : undefined
  const masked = cutout ? { maskImage: cutout, WebkitMaskImage: cutout } : undefined

  return (
    <div className={cn("@container relative size-8 shrink-0", className)}>
      <Avatar className={cn("size-full after:hidden", src && "bg-item-selected/40")} style={masked}>
        {src && !animated && <AvatarImage src={src} alt="" />}
        {/* With a photo, initials only appear if it's slow or broken: they'd otherwise
            flash for a frame on every mount, even when the photo is cached. */}
        <AvatarFallback
          delayMs={src ? 1000 : undefined}
          className="font-semibold text-white"
          style={{ backgroundColor: fallbackColor(userId) }}
        >
          <span className="text-[38cqw] leading-none">{initialsOf(name)}</span>
        </AvatarFallback>
      </Avatar>
      {src && animated && (
        <span className="absolute inset-0 overflow-hidden rounded-full" style={masked}>
          <AnimatedImage src={src} animate={animate} />
        </span>
      )}
      <AvatarDecoration kind={decoration} motion={animate} />
      {status && (
        // The outline: a disc in the background color filling the cutout, so the dot reads
        // as a fully ringed badge (its idle/DND/offline shapes show that color through).
        <span
          aria-hidden
          className="absolute rounded-full"
          style={{
            width: dot.size + dot.gap * 2,
            height: dot.size + dot.gap * 2,
            right: dot.offset - dot.gap,
            bottom: dot.offset - dot.gap,
            backgroundColor: ringColor ?? (surface ? SURFACE_COLOR[surface] : "var(--sidebar)"),
            // A hovered or selected row's tint, layered on top (see --ring-tint in globals.css).
            backgroundImage: ringColor ? undefined : "linear-gradient(var(--ring-tint, transparent), var(--ring-tint, transparent))",
          }}
        />
      )}
      {status && (
        <StatusDot
          status={status}
          className="absolute"
          style={{ width: dot.size, height: dot.size, right: dot.offset, bottom: dot.offset }}
        />
      )}
    </div>
  )
}
