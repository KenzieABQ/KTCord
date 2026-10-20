"use client"

import type { ReactNode } from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** An icon button in the channel header (Threads, Pins, Members, ...). */
export function HeaderButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
  className,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            "flex size-8 items-center justify-center rounded-md text-interactive transition-colors hover:text-interactive-hover disabled:pointer-events-none disabled:opacity-40",
            active && "text-interactive-active",
            className
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
