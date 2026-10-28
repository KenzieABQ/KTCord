import { useId, type CSSProperties } from "react"

import { cn } from "@/lib/utils"

export type PresenceStatus = "online" | "idle" | "dnd" | "offline"

/** Kept for callers that still say where the dot sits; the cutout is truly transparent now. */
export type Surface = "rail" | "sidebar" | "chat" | "card" | "floating" | "composer"

export const STATUS_LABEL: Record<PresenceStatus, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  offline: "Offline",
}

const STATUS_FILL: Record<PresenceStatus, string> = {
  online: "fill-status-online",
  idle: "fill-status-idle",
  dnd: "fill-status-dnd",
  offline: "fill-status-offline",
}

/**
 * Presence dot with Discord-style shapes: a crescent for idle, a bar for DND, a ring for
 * offline. The shapes are cut out (see-through), not painted in a background color.
 */
export function StatusDot({
  status,
  className,
  style,
}: {
  status: PresenceStatus
  surface?: Surface
  className?: string
  style?: CSSProperties
}) {
  const mask = `status-${useId().replace(/:/g, "")}`
  return (
    <svg viewBox="0 0 10 10" role="img" aria-label={STATUS_LABEL[status]} className={cn("size-3.5 shrink-0", className)} style={style}>
      <mask id={mask}>
        <circle cx="5" cy="5" r="5" fill="#fff" />
        {status === "idle" && <circle cx="2.5" cy="2.5" r="3.75" fill="#000" />}
        {status === "dnd" && <rect x="1.75" y="3.75" width="6.5" height="2.5" rx="1.25" fill="#000" />}
        {status === "offline" && <circle cx="5" cy="5" r="2.5" fill="#000" />}
      </mask>
      <circle cx="5" cy="5" r="5" mask={`url(#${mask})`} className={STATUS_FILL[status]} />
    </svg>
  )
}
