"use client"

import { formatDistanceToNowStrict } from "date-fns"
import { MessagesSquareIcon, PinIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "@/lib/toast"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { errorMessage } from "@/lib/api/errors"
import { usePinMessage, usePins, useThreads } from "@/lib/queries/messages"
import { useUiStore } from "@/lib/stores/ui-store"
import { cn } from "@/lib/utils"

import { useChat } from "./chat-context"
import { MessagePreview } from "./message-preview"

function HeaderPopoverButton({ id, label, open, children }: { id: string; label: string; open: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <PopoverTrigger
          id={id}
          aria-label={label}
          className={cn(
            "flex size-8 items-center justify-center rounded-md text-interactive outline-none focus-visible:ring-2 focus-visible:ring-ring hover:text-interactive-hover",
            open && "text-interactive-active"
          )}
        >
          {children}
        </PopoverTrigger>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

function Loading() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full bg-item-selected/60" />
      ))}
    </div>
  )
}

/** Header button + list of this channel's pinned messages. */
export function PinsPopover() {
  const { channel, canPin, jumpToMessage } = useChat()
  const [open, setOpen] = useState(false)
  const { data: pins, isPending } = usePins(channel.id, open)
  const pin = usePinMessage(channel.id)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <HeaderPopoverButton id="pins-button" label="Pinned Messages" open={open}>
        <PinIcon className="size-5" />
      </HeaderPopoverButton>
      <PopoverContent align="end" className="w-[420px] max-w-[95vw] overflow-hidden border-0 bg-sidebar p-0 shadow-2xl">
        <h2 className="flex h-12 items-center gap-2 bg-floating px-4 font-semibold text-header">
          <PinIcon className="size-4" /> Pinned Messages
        </h2>
        <div className="max-h-[60vh] overflow-y-auto">
          {isPending ? (
            <Loading />
          ) : !pins?.length ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <PinIcon className="size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                This channel doesn&apos;t have any pinned messages… yet.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-3">
              {pins.map((m) => (
                <MessagePreview
                  key={m.id}
                  message={m}
                  actions={
                    <>
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => {
                          setOpen(false)
                          jumpToMessage(m.id)
                        }}
                      >
                        Jump
                      </Button>
                      {canPin && (
                        <Button
                          size="icon-xs"
                          variant="secondary"
                          aria-label="Unpin"
                          onClick={() =>
                            pin.mutate(
                              { messageId: m.id, pinned: false },
                              { onError: (e) => toast.error(errorMessage(e)) }
                            )
                          }
                        >
                          <XIcon />
                        </Button>
                      )}
                    </>
                  }
                />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Header button + list of threads started in this channel. */
export function ThreadsPopover() {
  const { channel } = useChat()
  const [open, setOpen] = useState(false)
  const { data: threads, isPending } = useThreads(channel.id, open)
  const openSidePanel = useUiStore((s) => s.openSidePanel)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <HeaderPopoverButton id="threads-button" label="Threads" open={open}>
        <MessagesSquareIcon className="size-5" />
      </HeaderPopoverButton>
      <PopoverContent align="end" className="w-[380px] max-w-[95vw] overflow-hidden border-0 bg-sidebar p-0 shadow-2xl">
        <h2 className="flex h-12 items-center gap-2 bg-floating px-4 font-semibold text-header">
          <MessagesSquareIcon className="size-4" /> Threads
        </h2>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {isPending ? (
            <Loading />
          ) : !threads?.length ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <MessagesSquareIcon className="size-10 text-muted-foreground" />
              <p className="font-semibold text-header">There are no threads.</p>
              <p className="text-sm text-muted-foreground">
                Stay focused on a conversation: hover a message and pick &quot;Create Thread&quot;.
              </p>
            </div>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setOpen(false)
                  openSidePanel({ kind: "thread", channelId: channel.id, threadId: t.id })
                }}
                className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-item-hover"
              >
                <span className="font-semibold text-header">{t.name}</span>
                <span className="text-xs text-muted-foreground">
                  {t.message_count} {t.message_count === 1 ? "message" : "messages"}
                  {t.last_message_at &&
                    ` · ${formatDistanceToNowStrict(new Date(t.last_message_at), { addSuffix: true })}`}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
