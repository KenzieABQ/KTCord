"use client"

import { Button } from "@/components/ui/button"

import { KtcordMark } from "./logo"

/** Full-screen KTCord loader, shown while the session and profile load. */
export function SplashScreen({
  message = "Loading KTCord…",
  error,
  onRetry,
  onSignOut,
}: {
  message?: string
  error?: string | null
  onRetry?: () => void
  onSignOut?: () => void
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-rail p-6 text-center">
      <KtcordMark
        className={
          error ? "size-16 text-muted-foreground" : "size-16 animate-pulse text-primary"
        }
      />
      {error ? (
        <div className="flex max-w-sm flex-col items-center gap-4">
          <p className="text-sm text-foreground">{error}</p>
          <div className="flex gap-2">
            {onRetry && <Button onClick={onRetry}>Try again</Button>}
            {onSignOut && (
              <Button variant="secondary" onClick={onSignOut}>
                Log out
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {message}
        </p>
      )}
    </div>
  )
}
