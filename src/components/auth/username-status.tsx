import { CheckIcon, LoaderIcon, XIcon } from "@/components/icons"

import type { UsernameAvailability } from "@/hooks/use-username-availability"

/** Inline availability hint shown under a username field. */
export function UsernameStatus({ status }: { status: UsernameAvailability }) {
  switch (status) {
    case "checking":
      return (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <LoaderIcon className="size-3 animate-spin" /> Checking…
        </p>
      )
    case "available":
      return (
        <p className="flex items-center gap-1 text-xs text-status-online">
          <CheckIcon className="size-3" /> Username is available
        </p>
      )
    case "taken":
      return (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <XIcon className="size-3" /> That username is taken
        </p>
      )
    default:
      return null
  }
}
