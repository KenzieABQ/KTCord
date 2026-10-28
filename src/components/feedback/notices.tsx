"use client"

import { CircleAlertIcon, InfoIcon, XIcon } from "lucide-react"
import { toast as sonner, Toaster } from "sonner"

import { UserAvatar } from "@/components/profile/user-avatar"
import { cn } from "@/lib/utils"

export type NoticeAction = { label: string; onClick: () => void }

/** A small pill at the top of the window: errors and the odd heads-up, like Discord's notices. */
export function Notice({
  id,
  kind,
  message,
  action,
}: {
  id: string | number
  kind: "info" | "error"
  message: string
  action?: NoticeAction
}) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className="pointer-events-auto flex max-w-[min(92vw,480px)] items-center gap-2.5 rounded-full border border-border bg-floating py-2 pr-2 pl-3.5 text-sm font-medium text-header shadow-2xl"
    >
      {kind === "error" ? (
        <CircleAlertIcon className="size-4 shrink-0 text-destructive" />
      ) : (
        <InfoIcon className="size-4 shrink-0 text-primary" />
      )}
      <span className="min-w-0 flex-1">{message}</span>
      {action && (
        <button
          type="button"
          onClick={() => {
            action.onClick()
            sonner.dismiss(id)
          }}
          className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary/85"
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => sonner.dismiss(id)}
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-interactive hover:bg-item-hover hover:text-interactive-hover"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  )
}

export type DmNotification = {
  authorId: string
  author: string
  avatarUrl: string | null
  place: string
  preview: string
  onOpen: () => void
}

/** An incoming direct message: a card with who wrote, where, and what they said. Click to open. */
export function DmNotice({ id, dm }: { id: string | number; dm: DmNotification }) {
  return (
    <div className="group/dm pointer-events-auto relative w-[min(92vw,360px)]">
      <button
        type="button"
        onClick={() => {
          dm.onOpen()
          sonner.dismiss(id)
        }}
        className="flex w-full items-start gap-3 rounded-2xl border border-border bg-floating p-3 text-left shadow-2xl transition-colors hover:bg-card"
      >
        <span className="relative shrink-0">
          <UserAvatar userId={dm.authorId} name={dm.author} src={dm.avatarUrl} className="size-11" animate="always" />
          <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-primary ring-[3px] ring-floating">
            <svg viewBox="0 0 24 24" className="size-3 fill-white" aria-hidden>
              <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2Z" />
            </svg>
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate font-semibold text-header">{dm.author}</span>
            <span className="shrink-0 text-xs text-muted-foreground">now</span>
          </span>
          <span className="block truncate text-xs font-medium text-muted-foreground">{dm.place}</span>
          <span className={cn("mt-1 line-clamp-2 text-sm break-words text-foreground")}>{dm.preview}</span>
        </span>
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => sonner.dismiss(id)}
        className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-rail text-interactive opacity-0 transition-opacity group-hover/dm:opacity-100 hover:text-interactive-hover focus-visible:opacity-100"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  )
}

/** Where notices (top center) and DM cards (bottom right) appear. Styling is all ours. */
export function FeedbackHost() {
  return (
    <>
      <Toaster id="notices" position="top-center" offset={16} gap={8} toastOptions={{ unstyled: true }} />
      <Toaster id="dms" position="bottom-right" offset={20} gap={10} visibleToasts={3} toastOptions={{ unstyled: true }} />
    </>
  )
}
