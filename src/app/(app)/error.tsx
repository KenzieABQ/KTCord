"use client"

import { RouteError } from "@/components/brand/route-error"

/** Catches crashes in the app shell itself and in the settings pages. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} />
}
