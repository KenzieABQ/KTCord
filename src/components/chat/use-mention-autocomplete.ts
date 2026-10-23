"use client"

import { useMemo, useState, type KeyboardEvent, type RefObject } from "react"

import { customEmojiToken, searchEmoji } from "@/lib/emoji"
import { memberDisplayName } from "@/lib/members"
import { findTrigger, rankMatches, type MentionTrigger } from "@/lib/mentions"
import { useCustomEmoji, useEmojiData } from "@/lib/queries/emoji"
import { useEmojiStore } from "@/lib/stores/emoji-store"

import { useChat } from "./chat-context"
import type { MentionOption } from "./mention-popup"

/**
 * Drives the @ / # / : suggestion popup for a textarea: tracks the trigger under the caret,
 * ranks matches, handles arrow keys/Enter/Tab/Escape, and inserts the choice.
 */
export function useMentionAutocomplete(
  inputRef: RefObject<HTMLTextAreaElement | null>,
  value: string,
  setValue: (next: string) => void
) {
  const { serverId, membersById, rolesById, channelsById, canMentionEveryone } = useChat()
  const emojiData = useEmojiData()
  const customEmoji = useCustomEmoji(serverId)
  const skinTone = useEmojiStore((s) => s.skinTone)
  const [trigger, setTrigger] = useState<MentionTrigger | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)

  const options = useMemo<MentionOption[]>(() => {
    if (!trigger || dismissedAt === trigger.start) return []
    if (trigger.kind === ":") {
      // Custom emoji insert as :name: (encoded on send); standard ones as the character.
      const q = trigger.query.toLowerCase()
      const custom: MentionOption[] = customEmoji
        .filter((e) => e.name.toLowerCase().includes(q))
        .slice(0, 5)
        .map((e) => ({ kind: "emoji", id: e.id, label: `:${e.name}:`, insert: `:${e.name}:`, value: customEmojiToken(e) }))
      const standard: MentionOption[] = emojiData
        ? searchEmoji(emojiData, q, 10).map((e) => {
            const char = e.skins && skinTone > 0 ? e.skins[skinTone - 1] : e.char
            return { kind: "emoji", id: e.char, label: `:${e.names[0]}:`, insert: char, value: char }
          })
        : []
      return [...custom, ...standard].slice(0, 10)
    }
    if (trigger.kind === "#") {
      const channels = [...channelsById.values()].filter((c) => c.type === "text")
      return rankMatches(channels, trigger.query, (c) => [c.name ?? ""]).map((c) => ({
        kind: "channel",
        id: c.id,
        label: c.name ?? "",
        insert: `#${c.name}`,
      }))
    }
    const users: MentionOption[] = rankMatches([...membersById.values()], trigger.query, (m) => [
      m.profile.username,
      memberDisplayName(m),
    ]).map((m) => ({
      kind: "user",
      id: m.user_id,
      label: memberDisplayName(m),
      secondary: m.profile.username,
      insert: `@${m.profile.username}`,
      avatarUrl: m.profile.avatar_url,
    }))
    const roles: MentionOption[] = rankMatches(
      [...rolesById.values()].filter((r) => !r.is_default && (r.mentionable || canMentionEveryone)),
      trigger.query,
      (r) => [r.name],
      4
    ).map((r) => ({ kind: "role", id: r.id, label: `@${r.name}`, color: r.color, insert: `@${r.name}` }))
    const everyone: MentionOption[] = canMentionEveryone
      ? rankMatches(["everyone", "here"], trigger.query, (s) => [s]).map((s) => ({
          kind: "everyone",
          id: s,
          label: `@${s}`,
          secondary: s === "everyone" ? "Notify everyone who can see this channel." : "Notify everyone online.",
          insert: `@${s}`,
        }))
      : []
    return [...users, ...roles, ...everyone].slice(0, 10)
  }, [trigger, dismissedAt, membersById, rolesById, channelsById, canMentionEveryone, emojiData, customEmoji, skinTone])

  function updateTrigger() {
    const el = inputRef.current
    if (!el) return
    const next = findTrigger(el.value, el.selectionStart ?? el.value.length)
    setTrigger(next)
    if (next?.start !== trigger?.start || next?.query !== trigger?.query) setActiveIndex(0)
  }

  function pick(option: MentionOption) {
    const el = inputRef.current
    if (!el || !trigger) return
    const caret = el.selectionStart ?? value.length
    const insert = `${option.insert} `
    const next = value.slice(0, trigger.start) + insert + value.slice(caret)
    setValue(next)
    setTrigger(null)
    const position = trigger.start + insert.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(position, position)
    })
  }

  /** Returns true when the key was handled by the popup. */
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
    if (options.length === 0) return false
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      const delta = e.key === "ArrowDown" ? 1 : -1
      setActiveIndex((i) => (i + delta + options.length) % options.length)
      return true
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault()
      pick(options[Math.min(activeIndex, options.length - 1)])
      return true
    }
    if (e.key === "Escape") {
      e.preventDefault()
      setDismissedAt(trigger?.start ?? null)
      return true
    }
    return false
  }

  return {
    popup:
      options.length > 0
        ? {
            title:
              trigger?.kind === "#" ? "Text Channels" : trigger?.kind === ":" ? `Emoji matching :${trigger.query}` : "Members",
            options,
            activeIndex: Math.min(activeIndex, options.length - 1),
            onHover: setActiveIndex,
            onPick: pick,
          }
        : null,
    onKeyDown,
    updateTrigger,
  }
}
