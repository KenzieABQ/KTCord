"use client"

import { EmojiPicker } from "frimousse"
import { useState, type ReactNode } from "react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/** Searchable emoji grid (data loads from the emojibase CDN on first open, then caches). */
export function EmojiGrid({ onPick, className }: { onPick: (emoji: string) => void; className?: string }) {
  return (
    <EmojiPicker.Root
      className={cn("isolate flex h-[360px] w-[340px] flex-col bg-floating", className)}
      onEmojiSelect={({ emoji }) => onPick(emoji)}
      columns={9}
    >
      <EmojiPicker.Search
        autoFocus
        placeholder="Find the perfect emoji"
        className="z-10 mx-2 mt-2 h-9 appearance-none rounded-md bg-rail px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <EmojiPicker.Viewport className="relative flex-1 outline-hidden">
        <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Loading…
        </EmojiPicker.Loading>
        <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          No emoji found.
        </EmojiPicker.Empty>
        <EmojiPicker.List
          className="pb-1.5 select-none"
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div
                className="bg-floating px-3 pt-3 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                {...props}
              >
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div className="scroll-my-1.5 px-1.5" {...props}>
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button
                className="flex size-9 items-center justify-center rounded-md text-2xl data-[active]:bg-item-hover"
                {...props}
              >
                {emoji.emoji}
              </button>
            ),
          }}
        />
      </EmojiPicker.Viewport>
      <div className="flex h-10 items-center gap-2 border-t border-border px-3 text-sm text-muted-foreground">
        <EmojiPicker.ActiveEmoji>
          {({ emoji }) =>
            emoji ? (
              <>
                <span className="text-xl">{emoji.emoji}</span>
                <span className="truncate">{emoji.label}</span>
              </>
            ) : (
              <span>Pick an emoji…</span>
            )
          }
        </EmojiPicker.ActiveEmoji>
      </div>
    </EmojiPicker.Root>
  )
}

/** Wraps a trigger button in a popover with the emoji grid; closes after a pick. */
export function EmojiPickerPopover({
  children,
  onPick,
  side = "top",
  align = "end",
  onOpenChange,
}: {
  children: ReactNode
  onPick: (emoji: string) => void
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        onOpenChange?.(next)
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-auto overflow-hidden border-0 p-0 shadow-2xl">
        <EmojiGrid
          onPick={(emoji) => {
            onPick(emoji)
            setOpen(false)
            onOpenChange?.(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
