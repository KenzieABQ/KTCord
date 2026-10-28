"use client"

import { formatDistanceToNowStrict } from "date-fns"
import { CheckIcon, CircleCheckIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "@/lib/toast"

import { Button } from "@/components/ui/button"
import { errorMessage } from "@/lib/api/errors"
import type { ChatMessage, Poll } from "@/lib/messages/types"
import { useEndPoll, usePollVotes, useVotePoll } from "@/lib/queries/polls"
import { useUserId } from "@/lib/stores/auth-store"
import { cn } from "@/lib/utils"

import { useChat } from "./chat-context"
import { Emoji } from "./emoji"

/** True once the poll's time is up; flips by itself when it ends while on screen. */
function useEnded(expiresAt: string) {
  const end = Date.parse(expiresAt)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const left = end - Date.now()
    if (left <= 0) return
    const timer = setTimeout(() => setNow(Date.now()), Math.min(left + 50, 2 ** 31 - 1))
    return () => clearTimeout(timer)
  }, [end])
  return now >= end
}

/** A poll in a message: pick and vote, then see the results (or right away once it's closed). */
export function PollCard({ message, poll }: { message: ChatMessage; poll: Poll }) {
  const userId = useUserId()
  const { canManageMessages } = useChat()
  const sent = !message.status
  const { data: votes = [] } = usePollVotes(message.id, sent)
  const vote = useVotePoll(message.id)
  const endPoll = useEndPoll()
  const ended = useEnded(poll.expires_at)
  const [picked, setPicked] = useState<number[]>([])
  const [peeking, setPeeking] = useState(false)

  const { counts, voters, mine } = useMemo(() => {
    const counts = new Map<number, number>()
    const people = new Set<string>()
    const mine: number[] = []
    for (const v of votes) {
      counts.set(v.answer_id, (counts.get(v.answer_id) ?? 0) + 1)
      people.add(v.user_id)
      if (v.user_id === userId) mine.push(v.answer_id)
    }
    return { counts, voters: people.size, mine }
  }, [votes, userId])
  const voted = mine.length > 0
  const showResults = ended || voted || peeking
  const top = Math.max(0, ...counts.values())
  const canEnd = !ended && sent && (message.author_id === userId || canManageMessages)

  function toggle(id: number) {
    setPicked((list) =>
      poll.multiselect ? (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]) : list[0] === id ? [] : [id]
    )
  }
  const onError = (error: unknown) => toast.error(errorMessage(error))

  return (
    <section
      aria-label={`Poll: ${poll.question}`}
      className="mt-1 flex max-w-[440px] flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div>
        <h4 className="text-[1.0625em] font-semibold break-words text-header">{poll.question}</h4>
        <p className="text-xs text-muted-foreground">
          {ended ? "Poll closed" : showResults ? "Results" : poll.multiselect ? "Select one or more answers" : "Select one answer"}
        </p>
      </div>

      <ul className="flex flex-col gap-2" role={showResults ? undefined : poll.multiselect ? "group" : "radiogroup"}>
        {poll.answers.map((answer) => {
          const count = counts.get(answer.id) ?? 0
          const percent = voters ? Math.round((count / voters) * 100) : 0
          const chosen = showResults ? mine.includes(answer.id) : picked.includes(answer.id)
          const winner = ended && count > 0 && count === top
          const label = (
            <>
              {answer.emoji && <Emoji value={answer.emoji} />}
              <span className="min-w-0 flex-1 break-words">{answer.text}</span>
            </>
          )
          if (showResults) {
            return (
              <li
                key={answer.id}
                className={cn(
                  "relative flex items-center gap-2 overflow-hidden rounded-md border px-3 py-2 text-sm",
                  chosen || winner ? "border-primary" : "border-border"
                )}
              >
                <span
                  aria-hidden
                  className={cn("absolute inset-y-0 left-0 transition-[width]", chosen || winner ? "bg-primary/25" : "bg-item-selected/60")}
                  style={{ width: `${percent}%` }}
                />
                <span className="relative flex min-w-0 flex-1 items-center gap-2 text-foreground">
                  {label}
                  {chosen && <CircleCheckIcon aria-label="Your vote" className="size-4 shrink-0 text-primary" />}
                </span>
                <span className="relative shrink-0 text-xs font-semibold text-header tabular-nums">
                  {count} {count === 1 ? "vote" : "votes"} · {percent}%
                </span>
              </li>
            )
          }
          return (
            <li key={answer.id}>
              <button
                type="button"
                role={poll.multiselect ? "checkbox" : "radio"}
                aria-checked={chosen}
                disabled={!sent}
                onClick={() => toggle(answer.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm text-foreground hover:bg-item-hover",
                  chosen ? "border-primary bg-primary/10" : "border-border"
                )}
              >
                {label}
                <span
                  aria-hidden
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center border-2",
                    poll.multiselect ? "rounded" : "rounded-full",
                    chosen ? "border-primary bg-primary text-white" : "border-interactive/60"
                  )}
                >
                  {chosen && <CheckIcon className="size-3" strokeWidth={3} />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {voters} {voters === 1 ? "vote" : "votes"} ·{" "}
          {ended ? "Poll closed" : `${formatDistanceToNowStrict(new Date(poll.expires_at))} left`}
        </span>
        <span className="flex items-center gap-2">
          {canEnd && (
            <Button variant="ghost" size="sm" onClick={() => endPoll.mutate(message.id, { onError })}>
              End Poll
            </Button>
          )}
          {!ended && voted && (
            <Button variant="secondary" size="sm" disabled={vote.isPending} onClick={() => vote.mutate([], { onError })}>
              Remove Vote
            </Button>
          )}
          {!ended && !voted && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setPeeking((p) => !p)}>
                {peeking ? "Go back to vote" : "Show results"}
              </Button>
              {!peeking && (
                <Button
                  size="sm"
                  disabled={picked.length === 0 || vote.isPending || !sent}
                  onClick={() => vote.mutate(picked, { onError, onSuccess: () => setPicked([]) })}
                >
                  Vote
                </Button>
              )}
            </>
          )}
        </span>
      </div>
    </section>
  )
}
