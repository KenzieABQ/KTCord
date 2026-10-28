import type { CSSProperties, ReactNode } from "react"

import { nameStyle, type Cosmetics, type Decoration, type Nameplate, type ProfileEffect } from "@/lib/cosmetics"
import { cn } from "@/lib/utils"

type Motion = "hover" | "always"

/**
 * A display name in the user's name style (font, effect, colors). Without one it's a plain
 * span in `color` (a role color), so it can stand in anywhere a name is shown.
 */
export function StyledName({
  cosmetics,
  color,
  motion = "hover",
  className,
  children,
}: {
  cosmetics?: Cosmetics | null
  /** The usual color (a role color); a name style with its own colors overrides it. */
  color?: string
  /** Animated effects (shimmer, neon): only while the row is hovered, or always. */
  motion?: Motion
  className?: string
  children: ReactNode
}) {
  const style = nameStyle(cosmetics)
  if (!style) {
    return (
      <span className={className} style={color ? { color } : undefined}>
        {children}
      </span>
    )
  }
  const vars = style.colors
    ? ({ "--name-1": style.colors.first, "--name-2": style.colors.second } as CSSProperties)
    : color
      ? { color }
      : undefined
  return (
    <span data-motion={motion} className={cn(style.className, className)} style={vars}>
      {children}
    </span>
  )
}

/** The pieces each decoration draws (its look lives in globals.css). */
function decorationParts(kind: Decoration) {
  switch (kind) {
    case "neon":
    case "rainbow":
      return <span className="decor-ring" />
    case "fire":
      return (
        <>
          <span className="decor-ring" />
          {[18, 46, 72].map((left, i) => (
            <span key={i} className="decor-ember" style={{ left: `${left}%`, animationDelay: `${i * 0.5}s` }} />
          ))}
        </>
      )
    case "sparkles":
      return (
        <>
          <span className="decor-ring" />
          {[
            { left: "-2%", top: "8%", delay: 0 },
            { right: "-4%", top: "22%", delay: 0.6 },
            { left: "6%", bottom: "-2%", delay: 1.1 },
            { right: "12%", top: "-6%", delay: 1.5 },
          ].map(({ delay, ...at }, i) => (
            <span key={i} className="decor-spark" style={{ ...at, animationDelay: `${delay}s` }}>
              ✦
            </span>
          ))}
        </>
      )
    case "halo":
      return <span className="decor-halo-ring" />
    case "cat_ears":
      return (
        <>
          <span className="decor-ear" />
          <span className="decor-ear" />
        </>
      )
    case "orbit":
      return (
        <>
          <span className="decor-ring" />
          <span className="decor-moon" />
        </>
      )
    case "hearts":
      return (
        <>
          <span className="decor-ring" />
          {[4, 70, 38].map((left, i) => (
            <span key={i} className="decor-heart" style={{ left: `${left}%`, animationDelay: `${i * 0.8}s` }}>
              ♥
            </span>
          ))}
        </>
      )
    default:
      return null
  }
}

/** An animated frame around an avatar. Place inside the avatar's (relative, @container) box. */
export function AvatarDecoration({ kind, motion = "hover" }: { kind?: Decoration | null; motion?: Motion }) {
  if (!kind || kind === "none") return null
  return (
    <span aria-hidden data-motion={motion} className={cn("decor", `decor-${kind}`)}>
      {decorationParts(kind)}
    </span>
  )
}

/** Particle layouts are fixed per index, so every card with an effect looks the same. */
const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  x: `${(i * 37 + 11) % 96}%`,
  y: `${(i * 53 + 7) % 90}%`,
  size: 3 + ((i * 7) % 5),
  delay: -((i * 1.37) % 7),
  duration: 5 + ((i * 3) % 5),
  drift: `${((i * 17) % 40) - 20}px`,
}))

/** An animated overlay across a profile card. Place inside the card's (relative) box. */
export function ProfileEffectLayer({ kind }: { kind?: ProfileEffect | null }) {
  if (!kind || kind === "none") return null
  const count = kind === "aurora" ? 1 : kind === "stars" ? 12 : 14
  return (
    <div aria-hidden className={cn("profile-fx", `profile-fx-${kind}`)}>
      {PARTICLES.slice(0, count).map((p, i) => (
        <span
          key={i}
          style={
            {
              "--x": p.x,
              "--y": p.y,
              "--s": `${p.size}px`,
              "--d": `${p.delay}s`,
              "--t": `${kind === "stars" ? p.duration / 2 : p.duration}s`,
              "--drift": p.drift,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

/** A nameplate behind a list row. Place inside the row (relative, rounded, overflow hidden). */
export function NameplateLayer({ kind, motion = "hover" }: { kind?: Nameplate | null; motion?: Motion }) {
  if (!kind || kind === "none") return null
  return <span aria-hidden data-motion={motion} className={cn("nameplate", `nameplate-${kind}`)} />
}
