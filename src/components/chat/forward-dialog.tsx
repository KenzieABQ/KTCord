"use client"

import { useQueries, useQueryClient } from "@tanstack/react-query"
import { ForwardIcon, HashIcon, SearchIcon } from "@/components/icons"
import { useMemo, useState } from "react"
import { toast } from "@/lib/toast"

import { DmAvatar } from "@/components/dms/dm-avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { attachmentPath, copyAttachment, type Attachment } from "@/lib/api/attachments"
import { listChannels, type Channel } from "@/lib/api/channels"
import { dmTitle } from "@/lib/api/dms"
import { errorMessage } from "@/lib/api/errors"
import { sendMessage } from "@/lib/api/messages"
import { forwardOf, type ChatMessage } from "@/lib/messages/types"
import { qk } from "@/lib/queries/keys"
import { findCachedMessage } from "@/lib/queries/messages"
import { useMyServers } from "@/lib/queries/servers"
import { useVisibleDms } from "@/lib/queries/social"
import { useUserId } from "@/lib/stores/auth-store"
import { useUiStore } from "@/lib/stores/ui-store"
import { cn } from "@/lib/utils"

const MAX_DESTINATIONS = 5

type Destination =
  | { kind: "dm"; id: string; title: string; dmIndex: number }
  | { kind: "channel"; id: string; title: string; serverName: string }

const channelData = (results: { data?: Channel[] }[]) => results.map((r) => r.data)

/** Every DM and server text channel you can see, DMs first. */
function useDestinations(): Destination[] {
  const userId = useUserId()
  const { data: dms } = useVisibleDms()
  const { data: servers } = useMyServers()
  const channelsByServer = useQueries({
    queries: (servers ?? []).map((server) => ({
      queryKey: qk.channels(server.id),
      queryFn: () => listChannels(server.id),
    })),
    combine: channelData,
  })
  return useMemo(() => {
    const out: Destination[] = (dms ?? []).map((dm, dmIndex) => ({ kind: "dm", id: dm.id, title: dmTitle(dm, userId), dmIndex }))
    ;(servers ?? []).forEach((server, i) => {
      for (const channel of channelsByServer[i] ?? []) {
        if (channel.type === "text") out.push({ kind: "channel", id: channel.id, title: channel.name ?? "", serverName: server.name })
      }
    })
    return out
  }, [dms, servers, channelsByServer, userId])
}

/** Copies the message's files into the new message's folder, so its viewers can open them. */
async function copiedAttachments(message: ChatMessage, channelId: string, newId: string): Promise<Attachment[]> {
  const files = (message.attachments ?? []) as unknown as Attachment[]
  return Promise.all(
    files.map(async (file, index) => {
      const path = attachmentPath(channelId, newId, index, file.name)
      await copyAttachment(file.path, path)
      return { ...file, path }
    })
  )
}

/** Discord's Forward: pick up to five channels or DMs, optionally add a message. */
export function ForwardDialog({ messageId }: { messageId: string }) {
  const queryClient = useQueryClient()
  const closeDialog = useUiStore((s) => s.closeDialog)
  const { data: dms } = useVisibleDms()
  const message = findCachedMessage(queryClient, messageId)
  const destinations = useDestinations()
  const [query, setQuery] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const [comment, setComment] = useState("")
  const [sending, setSending] = useState(false)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q
      ? destinations.filter((d) => d.title.toLowerCase().includes(q) || (d.kind === "channel" && d.serverName.toLowerCase().includes(q)))
      : destinations
  }, [destinations, query])

  if (!message) {
    return (
      <DialogHeader>
        <DialogTitle>Forward</DialogTitle>
        <DialogDescription>That message isn&apos;t available anymore.</DialogDescription>
      </DialogHeader>
    )
  }
  const source = message
  const preview = forwardOf(source)?.content ?? source.content
  const fileCount = (source.attachments as unknown[] | null)?.length ?? 0

  async function send() {
    setSending(true)
    let failed = 0
    for (const channelId of picked) {
      try {
        const id = crypto.randomUUID()
        await sendMessage({
          id,
          channelId,
          content: "",
          replyToId: null,
          attachments: await copiedAttachments(source, channelId, id),
          forwardId: source.id,
        })
        if (comment.trim()) {
          await sendMessage({ id: crypto.randomUUID(), channelId, content: comment.trim(), replyToId: null })
        }
      } catch (error) {
        failed += 1
        toast.error(errorMessage(error))
      }
    }
    setSending(false)
    if (failed < picked.length) {
      toast.success(picked.length - failed === 1 ? "Message forwarded." : `Forwarded to ${picked.length - failed} places.`)
      closeDialog()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Forward To</DialogTitle>
        <DialogDescription>Pick up to {MAX_DESTINATIONS} channels or conversations.</DialogDescription>
      </DialogHeader>

      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search channels and conversations"
          className="bg-input pl-8"
          autoFocus
        />
      </div>

      <ul className="-mx-2 flex max-h-64 flex-col overflow-y-auto" aria-label="Destinations">
        {shown.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">Nothing matches.</li>}
        {shown.map((d) => {
          const checked = picked.includes(d.id)
          const dm = d.kind === "dm" ? dms?.[d.dmIndex] : undefined
          return (
            <li key={d.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-item-hover",
                  !checked && picked.length >= MAX_DESTINATIONS && "cursor-not-allowed opacity-50"
                )}
              >
                {dm ? (
                  <DmAvatar dm={dm} className="size-8" showStatus={false} />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-full bg-sidebar text-muted-foreground">
                    <HashIcon className="size-4" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-header">{d.title}</span>
                  {d.kind === "channel" && <span className="block truncate text-xs text-muted-foreground">{d.serverName}</span>}
                </span>
                <Checkbox
                  checked={checked}
                  disabled={!checked && picked.length >= MAX_DESTINATIONS}
                  onCheckedChange={(on) => setPicked((list) => (on ? [...list, d.id] : list.filter((id) => id !== d.id)))}
                  aria-label={`Forward to ${d.title}`}
                />
              </label>
            </li>
          )
        })}
      </ul>

      <div className="rounded-md border-l-4 border-border bg-sidebar px-3 py-2 text-sm">
        <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground italic">
          <ForwardIcon className="size-3.5" /> Forwarded
        </p>
        <p className="line-clamp-3 break-words whitespace-pre-wrap text-foreground">
          {preview || `${fileCount} ${fileCount === 1 ? "attachment" : "attachments"}`}
        </p>
      </div>

      <Input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={2000}
        placeholder="Add an optional message…"
        aria-label="Optional message"
        className="bg-input"
      />

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={closeDialog}>
          Cancel
        </Button>
        <Button disabled={picked.length === 0 || sending} onClick={() => void send()}>
          {sending ? "Sending…" : picked.length > 1 ? `Send (${picked.length})` : "Send"}
        </Button>
      </div>
    </div>
  )
}
