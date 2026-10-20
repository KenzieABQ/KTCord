import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { Database } from "./database.types"
import {
  isSupabaseConfigured,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "./env"

/**
 * Refreshes the Supabase session cookie and returns the signed-in user's id (or null).
 * The response must be returned as-is so refreshed cookies reach the browser.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  if (!isSupabaseConfigured) return { response, userId: null }

  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
          for (const [key, value] of Object.entries(headers ?? {})) {
            response.headers.set(key, value)
          }
        },
      },
    }
  )

  // Don't put code between client creation and getClaims(): it can cause hard-to-debug logouts.
  const { data } = await supabase.auth.getClaims()
  const userId = (data?.claims?.sub as string | undefined) ?? null

  return { response, userId }
}

/** Copies refreshed auth cookies onto a redirect so the session isn't lost. */
export function redirectWithCookies(
  url: URL,
  from: NextResponse
): NextResponse {
  const redirect = NextResponse.redirect(url)
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie)
  }
  return redirect
}
