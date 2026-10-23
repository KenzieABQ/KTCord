"use client"

import { AtSignIcon, HashIcon } from "lucide-react"
import { useEffect, useRef } from "react"

import { UserAvatar } from "@/components/profile/user-avatar"
import { cn } from "@/lib/utils"

import { Emoji } from "./emoji"

export type MentionOption =
  | { kind: "user"; id: string; label: string; secondary: string; insert: string; avatarUrl: string | null }
  | { kind: "role"; id: string; label: string; color: string | null; insert: string }
  | { kind: "everyone"; id: string; label: string; secondary: string; insert: string }
  | { kind: "channel"; id: string; label: string; insert: string }
  /** `value` is the character or custom emoji token to draw. */
  | { kind: "emoji"; id: string; label: string; insert: string; value: string }

/** The suggestion list above the composer while typing @…, #… or :…. */
export function MentionPopup({
  title,
  options,
  activeIndex,
  onHover,
  onPick,
}: {
  title: string
  options: MentionOption[]
  activeIndex: number
  onHover: (index: number) => void
  onPick: (option: MentionOption) => void
}) {
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  return (
    <div className="absolute inset-x-0 bottom-full mb-2 overflow-hidden rounded-lg bg-floating shadow-xl ring-1 ring-border">
      <p className="px-3 pt-2 pb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">{title}</p>
      <ul ref={listRef} role="listbox" aria-label={title} className="max-h-72 overflow-y-auto p-1.5 pt-0">
        {options.map((option, index) => (
          <li
            key={`${option.kind}:${option.id}`}
            role="option"
            aria-selected={index === activeIndex}
            data-index={index}
            onMouseEnter={() => onHover(index)}
            // mousedown keeps focus in the textarea
            onMouseDown={(e) => {
              e.preventDefault()
              onPick(option)
            }}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
              index === activeIndex ? "bg-item-selected text-interactive-active" : "text-interactive"
            )}
          >
            {option.kind === "user" && (
              <UserAvatar userId={option.id} name={option.label} src={option.avatarUrl} className="size-6" />
            )}
            {option.kind === "role" && (
              <AtSignIcon className="size-5" style={option.color ? { color: option.color } : undefined} />
            )}
            {option.kind === "everyone" && <AtSignIcon className="size-5" />}
            {option.kind === "channel" && <HashIcon className="size-5" />}
            {option.kind === "emoji" && <Emoji value={option.value} className="size-6 text-xl leading-none" />}
            <span
              className="min-w-0 flex-1 truncate font-medium"
              style={option.kind === "role" && option.color ? { color: option.color } : undefined}
            >
              {option.label}
            </span>
            {"secondary" in option && <span className="shrink-0 truncate text-xs text-muted-foreground">{option.secondary}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
