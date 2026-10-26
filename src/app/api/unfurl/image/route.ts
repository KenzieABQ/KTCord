import type { NextRequest } from "next/server"

import { allow } from "@/lib/rate-limit"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { safeGet } from "@/lib/unfurl/fetch"

// Raster formats only: SVG can carry scripts, and this is served from our own origin.
const IMAGE_TYPE = /^image\/(png|jpe?g|gif|webp|avif|bmp)$/

/**
 * Proxies a link preview's image, so other sites don't see who's reading the chat. Same
 * safety rules as /api/unfurl; responses are sandboxed and never sniffed.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")
  if (!url || url.length > 2048) return new Response(null, { status: 400 })

  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getClaims()
  const userId = auth?.claims.sub
  if (!userId) return new Response(null, { status: 401 })
  if (!allow(`unfurl-image:${userId}`, 200, 60_000)) return new Response(null, { status: 429 })

  try {
    const image = await safeGet(url, { accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9", maxBytes: 8 * 1024 * 1024 })
    const type = image.contentType.split(";")[0].trim()
    if (!IMAGE_TYPE.test(type)) return new Response(null, { status: 415 })
    return new Response(new Uint8Array(image.body), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Disposition": "inline",
      },
    })
  } catch {
    return new Response(null, { status: 502 })
  }
}
