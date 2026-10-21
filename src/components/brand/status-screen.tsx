import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import { KtcordLogo } from "./logo"

/**
 * A full-page branded card for dead ends: not found, crashed views, invalid links.
 * `inline` fits it inside the app shell's main column instead of the whole window.
 */
export function StatusScreen({
  title,
  description,
  actions,
  inline = false,
}: {
  title: string
  description: ReactNode
  actions?: ReactNode
  inline?: boolean
}) {
  return (
    <div className={cn("relative flex w-full overflow-y-auto", inline ? "min-h-0 flex-1 bg-chat" : "h-full bg-rail")}>
      {!inline && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 bg-[radial-gradient(60rem_40rem_at_15%_-10%,color-mix(in_oklab,var(--brand)_35%,transparent),transparent)]"
        />
      )}
      <main className="relative m-auto flex w-full max-w-md flex-col items-center gap-6 px-4 py-10">
        {!inline && <KtcordLogo className="text-3xl" markClassName="size-11" />}
        <div className={cn("w-full rounded-lg p-8 text-center", inline ? "bg-sidebar" : "bg-chat shadow-2xl")}>
          <h1 className="text-2xl font-semibold text-header">{title}</h1>
          <div className="mt-2 text-muted-foreground">{description}</div>
          {actions && <div className="mt-6 flex flex-col gap-2">{actions}</div>}
        </div>
      </main>
    </div>
  )
}
