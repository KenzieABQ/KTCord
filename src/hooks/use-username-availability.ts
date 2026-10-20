"use client"

import { useQuery } from "@tanstack/react-query"

import { isUsernameAvailable } from "@/lib/api/profiles"
import { usernameSchema } from "@/lib/validation"

import { useDebouncedValue } from "./use-debounced-value"

export type UsernameAvailability =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "unknown"

/** Debounced availability check. `current` is the user's existing username, which counts as available. */
export function useUsernameAvailability(
  raw: string,
  current?: string
): UsernameAvailability {
  const parsed = usernameSchema.safeParse(raw)
  const candidate = parsed.success ? parsed.data : null
  const debounced = useDebouncedValue(candidate, 400)
  const unchanged = candidate !== null && candidate === current

  const query = useQuery({
    queryKey: ["username-available", debounced],
    queryFn: () => isUsernameAvailable(debounced!),
    enabled: Boolean(debounced) && !unchanged,
    staleTime: 10_000,
    retry: false,
  })

  if (!candidate) return "idle"
  if (unchanged) return "available"
  if (candidate !== debounced || query.isFetching) return "checking"
  if (query.isError) return "unknown"
  if (query.data === undefined) return "checking"
  return query.data ? "available" : "taken"
}
