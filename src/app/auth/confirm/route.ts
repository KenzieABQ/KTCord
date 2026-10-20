import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * Lands email-confirmation links. Handles both the PKCE `code` flow (the default
 * email template) and the `token_hash` flow (a custom template).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const next = searchParams.get("next")
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/channels/me"

  const supabase = await createSupabaseServerClient()
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null

  let ok = false
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error
  }

  return NextResponse.redirect(
    new URL(ok ? target : "/login?error=confirm", request.url)
  )
}
