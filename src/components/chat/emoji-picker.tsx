"use client"

import {
  AppleIcon,
  ChevronDownIcon,
  ClockIcon,
  FlagIcon,
  HeartIcon,
  LeafIcon,
  LightbulbIcon,
  PlaneIcon,
  SearchIcon,
  SmileIcon,
  TrophyIcon,
  XIcon,
} from "lucide-react"
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react"

import { ServerIcon } from "@/components/servers/server-icon"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { customEmojiToken, searchEmoji, SKIN_TONES, withSkinTone } from "@/lib/emoji"
import { useCustomEmoji, useEmojiData } from "@/lib/queries/emoji"
import { useMyServers } from "@/lib/queries/servers"
import { frequentEmoji, useEmojiStore } from "@/lib/stores/emoji-store"
import { cn } from "@/lib/utils"

import { useOptionalChat } from "./chat-context"
import { Emoji } from "./emoji"

const CATEGORY_ICONS = [SmileIcon, LeafIcon, AppleIcon, TrophyIcon, PlaneIcon, LightbulbIcon, HeartIcon, FlagIcon]

type Item = { value: string; name: string; source?: string }
type Section = { key: string; label: string; icon: ReactNode; items: Item[] }

function SkinTonePicker() {
  const data = useEmojiData()
  const skinTone = useEmojiStore((s) => s.skinTone)
  const setSkinTone = useEmojiStore((s) => s.setSkinTone)
  const [open, setOpen] = useState(false)
  const hand = data?.byName.get("raised_hand")
  if (!hand) return null

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Skin tone: ${SKIN_TONES[skinTone]}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex size-9 items-center justify-center rounded-md text-2xl hover:bg-item-hover"
      >
        {withSkinTone(hand, skinTone)}
      </button>
      {open && (
        <div
          role="radiogroup"
          aria-label="Skin tone"
          className="absolute top-0 right-0 z-20 flex flex-col gap-0.5 rounded-md bg-floating p-1 shadow-xl ring-1 ring-border"
        >
          {SKIN_TONES.map((label, tone) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={tone === skinTone}
              aria-label={label}
              onClick={() => {
                setSkinTone(tone)
                setOpen(false)
              }}
              className={cn(
                "flex size-9 items-center justify-center rounded-md text-2xl hover:bg-item-hover",
                tone === skinTone && "bg-item-selected"
              )}
            >
              {withSkinTone(hand, tone)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Discord-style emoji picker: search, a category rail (frequently used, each server's
 * custom emoji, then the standard categories), collapsible sections, skin tones, and a
 * footer naming the emoji under the pointer. `onPick` gets a character or a custom token.
 */
export function EmojiPicker({ onPick, allowCustom = true }: { onPick: (emoji: string) => void; allowCustom?: boolean }) {
  const chat = useOptionalChat()
  const data = useEmojiData()
  const custom = useCustomEmoji(chat?.serverId ?? null)
  const { data: servers } = useMyServers()
  const skinTone = useEmojiStore((s) => s.skinTone)
  const usage = useEmojiStore((s) => s.usage)
  const recordUse = useEmojiStore((s) => s.recordUse)
  const [query, setQuery] = useState("")
  const [hovered, setHovered] = useState<Item | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [active, setActive] = useState("frequent")
  const scroller = useRef<HTMLDivElement>(null)

  const usable = useMemo(() => (allowCustom ? custom : []), [allowCustom, custom])
  const serverName = useCallback((id: string) => servers?.find((s) => s.id === id)?.name ?? "another server", [servers])

  const sections = useMemo<Section[]>(() => {
    const customItem = (e: (typeof usable)[number]): Item => ({
      value: customEmojiToken(e),
      name: e.name,
      source: serverName(e.serverId),
    })
    const standardItem = (char: string): Item | null => {
      const entry = data?.byChar.get(char)
      return entry ? { value: char, name: entry.names[0] } : null
    }

    const q = query.trim().toLowerCase().replace(/^:|:$/g, "")
    if (q) {
      const items = [
        ...usable.filter((e) => e.name.toLowerCase().includes(q)).map(customItem),
        ...(data ? searchEmoji(data, q).map((e) => ({ value: withSkinTone(e, skinTone), name: e.names[0] })) : []),
      ]
      return [{ key: "search", label: "Search Results", icon: <SearchIcon className="size-4" />, items }]
    }

    const result: Section[] = []
    const frequent = frequentEmoji(usage, 18)
      .map((value) => {
        const own = usable.find((e) => customEmojiToken(e) === value)
        return own ? customItem(own) : standardItem(value)
      })
      .filter((item): item is Item => item !== null)
    if (frequent.length > 0) {
      result.push({ key: "frequent", label: "Frequently Used", icon: <ClockIcon className="size-4" />, items: frequent })
    }

    const serverIds = [...new Set(usable.map((e) => e.serverId))]
    for (const id of serverIds) {
      const server = servers?.find((s) => s.id === id)
      result.push({
        key: `server:${id}`,
        label: server?.name ?? "Server",
        icon: (
          <span className="flex size-5 items-center justify-center overflow-hidden rounded-full bg-rail text-[8px] font-semibold text-header">
            <ServerIcon name={server?.name ?? "?"} iconUrl={server?.icon_url ?? null} />
          </span>
        ),
        items: usable.filter((e) => e.serverId === id).map(customItem),
      })
    }

    if (data) {
      data.categories.forEach((category, index) => {
        const Icon = CATEGORY_ICONS[index] ?? SmileIcon
        result.push({
          key: category.id,
          label: category.label,
          icon: <Icon className="size-4" />,
          items: data.emoji
            .filter((e) => e.category === index)
            .map((e) => ({ value: withSkinTone(e, skinTone), name: e.names[0] })),
        })
      })
    }
    return result
  }, [query, data, usable, usage, skinTone, servers, serverName])

  function pick(item: Item) {
    recordUse(item.value)
    onPick(item.value)
  }

  function jumpTo(key: string) {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-section="${CSS.escape(key)}"]`)
    // Sections are positioned relative to the scroller (it's `relative`).
    if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop })
    setActive(key)
  }

  function onScroll() {
    const box = scroller.current
    if (!box) return
    let current: string | undefined = sections[0]?.key
    for (const el of box.querySelectorAll<HTMLElement>("[data-section]")) {
      if (el.offsetTop <= box.scrollTop + 8) current = el.dataset.section ?? current
    }
    if (current && current !== active) setActive(current)
  }

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const empty = sections.every((s) => s.items.length === 0)

  return (
    <div className="flex h-[440px] w-[420px] max-w-[calc(100vw-16px)] flex-col overflow-hidden bg-floating">
      <div className="flex items-center gap-2 border-b border-border p-2">
        <div className="relative min-w-0 flex-1">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const first = sections[0]?.items[0]
                if (first) {
                  e.preventDefault()
                  pick(first)
                }
              }
            }}
            placeholder="Find the perfect emoji"
            aria-label="Search emoji"
            className="h-9 w-full rounded-md bg-rail pr-8 pl-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-interactive-hover"
            >
              <XIcon className="size-4" />
            </button>
          ) : (
            <SearchIcon className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground" />
          )}
        </div>
        <SkinTonePicker />
      </div>

      <div className="flex min-h-0 flex-1">
        {!query && (
          <nav aria-label="Emoji categories" className="scrollbar-none flex w-12 shrink-0 flex-col items-center gap-1 overflow-y-auto bg-rail/50 py-2">
            {sections.map((section, i) => (
              <div key={section.key} className="contents">
                {/* A divider between the custom emoji and the standard categories, as in Discord. */}
                {data && section.key === data.categories[0]?.id && i > 0 && <span className="my-1 h-px w-6 bg-border" />}
                <button
                  type="button"
                  aria-label={section.label}
                  title={section.label}
                  onClick={() => jumpTo(section.key)}
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md text-interactive hover:bg-item-hover hover:text-interactive-hover",
                    active === section.key && "bg-item-selected text-interactive-active"
                  )}
                >
                  {section.icon}
                </button>
              </div>
            ))}
          </nav>
        )}

        <div ref={scroller} onScroll={onScroll} className="scrollbar-thin relative min-w-0 flex-1 overflow-y-auto px-2 pb-2">
          {!data && sections.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Loading emoji…</p>}
          {data && empty && (
            <p className="p-6 text-center text-sm text-muted-foreground">No emoji match &ldquo;{query}&rdquo;.</p>
          )}
          {sections.map((section) =>
            section.items.length === 0 ? null : (
              <section key={section.key} data-section={section.key} aria-label={section.label}>
                <button
                  type="button"
                  onClick={() => toggle(section.key)}
                  aria-expanded={!collapsed.has(section.key)}
                  className="sticky top-0 z-10 flex w-full items-center gap-1.5 bg-floating pt-2 pb-1.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-interactive-hover"
                >
                  <span className="shrink-0">{section.icon}</span>
                  <span className="truncate">{section.label}</span>
                  <ChevronDownIcon
                    className={cn("ml-auto size-4 shrink-0 transition-transform", collapsed.has(section.key) && "-rotate-90")}
                  />
                </button>
                {!collapsed.has(section.key) && (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] [content-visibility:auto]">
                    {section.items.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        aria-label={`:${item.name}:`}
                        onClick={() => pick(item)}
                        onMouseEnter={() => setHovered(item)}
                        onFocus={() => setHovered(item)}
                        className="flex size-10 items-center justify-center rounded-md text-[28px] leading-none hover:bg-item-hover focus-visible:bg-item-hover focus-visible:outline-none"
                      >
                        <Emoji value={item.value} className="size-8" />
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )
          )}
        </div>
      </div>

      <div className="flex h-12 shrink-0 items-center gap-2.5 border-t border-border bg-rail/50 px-3">
        {hovered ? (
          <>
            <Emoji value={hovered.value} className="size-7 text-[26px] leading-none" />
            <span className="min-w-0 truncate text-sm font-semibold text-header">:{hovered.name}:</span>
            {hovered.source && <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground">from {hovered.source}</span>}
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Pick an emoji…</span>
        )}
      </div>
    </div>
  )
}

/** Wraps a trigger button in a popover with the emoji picker; closes after a pick. */
export function EmojiPickerPopover({
  children,
  onPick,
  side = "top",
  align = "end",
  allowCustom = true,
  onOpenChange,
}: {
  children: ReactNode
  onPick: (emoji: string) => void
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  allowCustom?: boolean
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
      <PopoverContent side={side} align={align} collisionPadding={8} className="w-auto overflow-hidden rounded-lg border-0 p-0 shadow-2xl">
        {open && (
          <EmojiPicker
            allowCustom={allowCustom}
            onPick={(emoji) => {
              onPick(emoji)
              setOpen(false)
              onOpenChange?.(false)
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}
