import type { CSSProperties } from "react"

import { cn } from "@/lib/utils"

export type PresenceStatus = "online" | "idle" | "dnd" | "offline"

/** The surface the dot sits on, so its cutout ring blends into the background. */
export type Surface = "rail" | "sidebar" | "chat" | "card" | "floating" | "composer"

export const STATUS_LABEL: Record<PresenceStatus, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  offline: "Offline",
}

const STATUS_BG: Record<PresenceStatus, string> = {
  online: "bg-status-online",
  idle: "bg-status-idle",
  dnd: "bg-status-dnd",
  offline: "bg-status-offline",
}

/** Presence dot with Discord-style shapes: a crescent for idle, a bar for DND, a ring for offline. */
export function StatusDot({
  status,
  surface = "sidebar",
  className,
}: {
  status: PresenceStatus
  surface?: Surface
  className?: string
}) {
  return (
    <span
      role="img"
      aria-label={STATUS_LABEL[status]}
      style={{ "--cutout": `var(--${surface})` } as CSSProperties}
      className={cn(
        "relative inline-flex size-3.5 items-center justify-center overflow-hidden rounded-full ring-[3px] ring-(--cutout)",
        STATUS_BG[status],
        className
      )}
    >
      {status === "idle" && (
        <span className="absolute -top-[15%] -left-[15%] size-[70%] rounded-full bg-(--cutout)" />
      )}
      {status === "dnd" && <span className="h-[25%] w-[62%] rounded-full bg-(--cutout)" />}
      {status === "offline" && <span className="size-[46%] rounded-full bg-(--cutout)" />}
    </span>
  )
}
