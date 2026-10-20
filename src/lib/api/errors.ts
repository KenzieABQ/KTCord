import type { PostgrestError } from "@supabase/supabase-js"

/** An error from the data layer with a message that's safe to show to the user. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly cause?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

const FRIENDLY_BY_CODE: Record<string, string> = {
  "23505": "That's already taken.",
  "42501": "You don't have permission to do that.",
  PGRST116: "We couldn't find that.",
}

export function toApiError(error: PostgrestError | Error): ApiError {
  if (error instanceof ApiError) return error
  const code = "code" in error ? error.code : undefined
  // RPCs raise exceptions with user-facing messages and the P0001 code.
  if (code === "P0001") return new ApiError(error.message, code, error)
  const friendly = code ? FRIENDLY_BY_CODE[code] : undefined
  return new ApiError(
    friendly ?? "Something went wrong. Try again.",
    code,
    error
  )
}

/** Returns `data`, or throws an ApiError if the Supabase call failed. */
export function unwrap<T>(result: {
  data: T | null
  error: PostgrestError | null
}): T {
  if (result.error) throw toApiError(result.error)
  return result.data as T
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return "Something went wrong. Try again."
}
