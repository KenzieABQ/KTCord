"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * One icon on the server rail: a circle that morphs into a rounded square when hovered or active,
 * with the left pill indicator (tall = active, short = unread) and an optional mention badge.
 */
export function RailItem({
  label,
  href,
  onClick,
  active = false,
  unread = false,
  mentions = 0,
  variant = "default",
  children,
}: {
  label: string
  href?: string
  onClick?: () => void
  active?: boolean
  unread?: boolean
  mentions?: number
  /** "action" items (Add a Server, Join) turn green on hover. */
  variant?: "default" | "brand" | "action"
  children: ReactNode
}) {
  const className = cn(
    "relative flex size-12 items-center justify-center overflow-hidden transition-[border-radius,background-color,color] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active ? "rounded-2xl" : "rounded-3xl hover:rounded-2xl focus-visible:rounded-2xl",
    variant === "default" &&
      (active ? "bg-primary text-white" : "bg-rail-item text-foreground hover:bg-primary hover:text-white"),
    variant === "brand" &&
      (active ? "bg-primary text-white" : "bg-rail-item text-foreground hover:bg-primary hover:text-white"),
    variant === "action" &&
      "bg-rail-item text-success hover:bg-success hover:text-white focus-visible:bg-success focus-visible:text-white"
  )

  return (
    <div className="group relative flex w-full justify-center">
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 left-0 w-1 -translate-y-1/2 rounded-r-full bg-header transition-all duration-200",
          active ? "h-10" : unread ? "h-2 group-hover:h-5" : "h-0 group-hover:h-5"
        )}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          {href ? (
            <Link
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={className}
            >
              {children}
            </Link>
          ) : (
            <button type="button" aria-label={label} onClick={onClick} className={className}>
              {children}
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={12} className="text-sm font-semibold">
          {label}
        </TooltipContent>
      </Tooltip>
      {mentions > 0 && (
        <span
          aria-label={`${mentions} mentions`}
          className="pointer-events-none absolute right-2.5 -bottom-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-mention px-1 text-[11px] leading-none font-bold text-white ring-4 ring-rail"
        >
          {mentions > 99 ? "99+" : mentions}
        </span>
      )}
    </div>
  )
}
