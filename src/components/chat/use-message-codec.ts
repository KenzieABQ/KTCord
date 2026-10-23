"use client"

import { useCallback } from "react"

import { decodeEmoji, encodeEmoji } from "@/lib/emoji"
import { decodeMentions, encodeMentions } from "@/lib/mentions"
import { useCustomEmoji, useEmojiData } from "@/lib/queries/emoji"

import { useChat } from "./chat-context"

/**
 * Turns what people type into what's stored, and back for editing: @mentions and #channels
 * become tokens, and :name: becomes a custom or standard emoji (as in Discord).
 */
export function useMessageCodec() {
  const { serverId, mentionSources } = useChat()
  const custom = useCustomEmoji(serverId)
  const data = useEmojiData()

  const encode = useCallback(
    (text: string) => encodeEmoji(encodeMentions(text, mentionSources), data, custom),
    [mentionSources, data, custom]
  )
  const decode = useCallback((text: string) => decodeEmoji(decodeMentions(text, mentionSources)), [mentionSources])
  return { encode, decode }
}
