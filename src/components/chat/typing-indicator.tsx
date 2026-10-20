"use client"

import { memberDisplayName } from "@/lib/members"
import { useUserId } from "@/lib/stores/auth-store"
import { describeTyping, useTypingUsers } from "@/lib/stores/typing-store"

import { useChat } from "./chat-context"

/** "Ava is typing…" with the bouncing dots. Keeps its height so the composer doesn't jump. */
export function TypingIndicator() {
  const userId = useUserId()
  const { channel, membersById } = useChat()
  const typing = useTypingUsers(channel.id, userId)
  const names = typing.map((id) => {
    const member = membersById.get(id)
    return member ? memberDisplayName(member) : "Someone"
  })
  const text = describeTyping(names)

  return (
    <div aria-live="polite" className="flex h-6 items-center gap-1.5 px-1 text-xs text-header">
      {text && (
        <>
          <span aria-hidden className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 animate-bounce rounded-full bg-interactive-hover"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
          <span className="truncate">
            {names.length <= 3 ? (
              <>
                <strong>{names.join(names.length === 2 ? " and " : ", ")}</strong>
                {names.length === 1 ? " is typing…" : " are typing…"}
              </>
            ) : (
              text
            )}
          </span>
        </>
      )}
    </div>
  )
}
