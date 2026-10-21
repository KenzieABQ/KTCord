import type { NextRequest } from "next/server"

import { redirectWithCookies, updateSession } from "@/lib/supabase/proxy"

const AUTH_PAGES = ["/login", "/register"]
const PUBLIC_PREFIXES = ["/auth/", "/invite/"]

/**
 * Optimistic auth routing. Real authorization lives in Postgres RLS;
 * this only keeps signed-out users off app pages and signed-in users off the login page.
 */
export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request)
  const { pathname, search } = request.nextUrl

  const isAuthPage = AUTH_PAGES.includes(pathname)
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))

  if (pathname === "/") {
    const target = userId ? "/channels/me" : "/login"
    return redirectWithCookies(new URL(target, request.url), response)
  }

  if (userId && isAuthPage) {
    const next = request.nextUrl.searchParams.get("next")
    const target = next?.startsWith("/") ? next : "/channels/me"
    return redirectWithCookies(new URL(target, request.url), response)
  }

  // API routes check the session themselves and answer 401, which fetch() can handle.
  if (!userId && !isAuthPage && !isPublic && !pathname.startsWith("/api/")) {
    const login = new URL("/login", request.url)
    login.searchParams.set("next", pathname + search)
    return redirectWithCookies(login, response)
  }

  return response
}

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next/static|_next/image|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
