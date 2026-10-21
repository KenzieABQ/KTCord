"use client"

import { SearchIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { SearchParams } from "@/lib/api/messages"
import { useSearch } from "@/lib/queries/messages"
import { isEmptySearch, parseSearch } from "@/lib/search-query"

import { useChat } from "./chat-context"
import { MessagePreview } from "./message-preview"

export const SEARCH_HINT = "from: user · mentions: user · has: image, video, file, link · in: channel"

/** Search results for a query typed in the channel header. Click one to jump to it. */
export function SearchPanel({ query, onClose }: { query: string; onClose: () => void }) {
  const router = useRouter()
  const { serverId, channel, basePath, membersById, channelsById, jumpToMessage } = useChat()

  const { params, unknown } = useMemo(() => {
    const parsed = parseSearch(query)
    const missing: string[] = []
    const byUsername = new Map([...membersById.values()].map((m) => [m.profile.username, m.user_id]))
    const byChannel = new Map([...channelsById.values()].map((c) => [c.name?.toLowerCase() ?? "", c.id]))
    const resolveUser = (name: string) => {
      const id = byUsername.get(name)
      if (!id) missing.push(`@${name}`)
      return id
    }
    const p: SearchParams = {
      // In a server, search the whole server; in DMs, just this conversation.
      ...(serverId ? { serverId } : { channelId: channel.id }),
      query: parsed.text,
      has: parsed.has,
    }
    if (parsed.from[0]) p.authorId = resolveUser(parsed.from[0])
    if (parsed.mentions[0]) p.mentionsId = resolveUser(parsed.mentions[0])
    if (parsed.in[0]) {
      const id = byChannel.get(parsed.in[0])
      if (id) p.channelId = id
      else missing.push(`#${parsed.in[0]}`)
    }
    return { params: isEmptySearch(parsed) ? null : p, unknown: missing }
  }, [query, serverId, channel.id, membersById, channelsById])

  const search = useSearch(serverId ?? channel.id, unknown.length ? null : params)
  const results = search.data?.pages.flatMap((p) => p.messages) ?? []
  const total = search.data?.pages[0]?.total ?? 0

  return (
    <div className="flex h-full min-w-0 flex-col bg-sidebar">
      <header className="flex h-12 shrink-0 items-center gap-2 bg-floating px-4">
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-header">
          {search.isPending && params ? "Searching…" : `${total} ${total === 1 ? "Result" : "Results"}`}
        </h2>
        <button
          type="button"
          aria-label="Close search"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-md text-interactive hover:text-interactive-hover"
        >
          <XIcon className="size-5" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-3">
        {unknown.length > 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No matches for {unknown.join(", ")}. Check the spelling.
          </p>
        ) : !params ? (
          <p className="p-4 text-center text-sm text-muted-foreground">Try a word, or filters: {SEARCH_HINT}</p>
        ) : search.isPending ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full bg-item-selected/60" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            We searched far and wide. Unfortunately, no results were found.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {results.map((m) => {
              const where = channelsById.get(m.channel_id)?.name
              const jump = () =>
                m.channel_id === channel.id ? jumpToMessage(m.id) : router.push(`${basePath}/${m.channel_id}/${m.id}`)
              // The card is clickable for pointer users; the Jump button is the keyboard path.
              // (A wrapping <button> would nest the mention buttons inside the message.)
              return (
                <div
                  key={m.id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    if (!(e.target as HTMLElement).closest("button, a")) jump()
                  }}
                >
                  {where && serverId && <p className="mb-1 text-xs font-semibold text-muted-foreground">#{where}</p>}
                  <MessagePreview
                    message={m}
                    actions={
                      <Button size="xs" variant="secondary" onClick={jump}>
                        Jump
                      </Button>
                    }
                  />
                </div>
              )
            })}
            {search.hasNextPage && (
              <Button variant="secondary" onClick={() => search.fetchNextPage()} disabled={search.isFetchingNextPage}>
                Load more
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
