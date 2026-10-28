"use client"

import { SmilePlusIcon } from "@/components/icons"
import { toast } from "@/lib/toast"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { errorMessage } from "@/lib/api/errors"
import { parseCustomEmoji } from "@/lib/emoji"
import { memberDisplayName } from "@/lib/members"
import type { ChatMessage } from "@/lib/messages/types"
import { useToggleReaction } from "@/lib/queries/messages"
import { useUserId } from "@/lib/stores/auth-store"
import { cn } from "@/lib/utils"

import { useChat } from "./chat-context"
import { Emoji } from "./emoji"
import { EmojiPickerPopover } from "./emoji-picker"

/** How a reaction reads in labels: the character, or :name: for a custom emoji. */
const emojiLabel = (emoji: string) => {
  const custom = parseCustomEmoji(emoji)
  return custom ? `:${custom.name}:` : emoji
}

type Group = { emoji: string; count: number; mine: boolean; userIds: string[] }

export function groupReactions(reactions: ChatMessage["reactions"], userId: string): Group[] {
  const groups = new Map<string, Group>()
  for (const r of reactions ?? []) {
    const g = groups.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false, userIds: [] }
    g.count++
    g.userIds.push(r.user_id)
    if (r.user_id === userId) g.mine = true
    groups.set(r.emoji, g)
  }
  return [...groups.values()]
}

/** Reaction pills under a message: click to add/remove yours; hover to see who reacted. */
export function ReactionBar({ message }: { message: ChatMessage }) {
  const userId = useUserId()
  const { channel, membersById } = useChat()
  const toggle = useToggleReaction(channel.id)
  const groups = groupReactions(message.reactions, userId)
  if (groups.length === 0 || message.status) return null

  const react = (emoji: string) =>
    toggle.mutate({ message, emoji }, { onError: (e) => toast.error(errorMessage(e)) })

  const names = (ids: string[]) => {
    const list = ids.map((id) => {
      const m = membersById.get(id)
      return id === userId ? "You" : m ? memberDisplayName(m) : "Someone"
    })
    if (list.length <= 3) return list.join(", ")
    return `${list.slice(0, 3).join(", ")} and ${list.length - 3} others`
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {groups.map((g) => (
        <Tooltip key={g.emoji}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-pressed={g.mine}
              aria-label={`${emojiLabel(g.emoji)} ${g.count}`}
              onClick={() => react(g.emoji)}
              className={cn(
                "flex h-6 items-center gap-1.5 rounded-md border px-1.5 text-sm transition-colors",
                g.mine
                  ? "border-primary bg-primary/15 text-header"
                  : "border-transparent bg-sidebar text-muted-foreground hover:border-interactive/40"
              )}
            >
              <Emoji value={g.emoji} className="size-4 text-base leading-none" />
              <span className="text-xs font-semibold">{g.count}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-56 text-center">
            {names(g.userIds)} reacted with {emojiLabel(g.emoji)}
          </TooltipContent>
        </Tooltip>
      ))}
      <EmojiPickerPopover onPick={react} side="top" align="start">
        <button
          type="button"
          aria-label="Add Reaction"
          className="flex h-6 items-center rounded-md bg-sidebar px-1.5 text-interactive opacity-0 group-hover:opacity-100 hover:text-interactive-hover focus-visible:opacity-100 data-[state=open]:opacity-100"
        >
          <SmilePlusIcon className="size-4" />
        </button>
      </EmojiPickerPopover>
    </div>
  )
}
