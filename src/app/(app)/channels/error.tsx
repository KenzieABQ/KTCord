"use client"

import { RouteError } from "@/components/brand/route-error"

/** A crashed view stays inside the shell, so the server rail and channels keep working. */
export default function ChannelsError({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} inline />
}
