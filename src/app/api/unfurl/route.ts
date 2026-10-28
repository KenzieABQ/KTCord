import type { NextRequest } from "next/server"

import { youtubeId, type Embed } from "@/lib/embeds"
import { allow } from "@/lib/rate-limit"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { safeGet } from "@/lib/unfurl/fetch"
import { imageEmbed, parseMeta, youtubeEmbed } from "@/lib/unfurl/meta"

const TTL_MS = 60 * 60_000
// Pages with nothing to show (or that failed) are retried sooner.
const EMPTY_TTL_MS = 5 * 60_000
const cache = new Map<string, { at: number; embed: Embed | null }>()

/** The page's text, in the charset its headers or <meta charset> declare (UTF-8 otherwise). */
function decodeHtml(body: Buffer, contentType: string) {
  const sniff = body.subarray(0, 2048).toString("latin1")
  const charset =
    contentType.match(/charset=["']?([\w-]+)/)?.[1] ?? sniff.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? "utf-8"
  try {
    return new TextDecoder(charset).decode(body)
  } catch {
    return new TextDecoder().decode(body)
  }
}

const isYouTube = (url: string) => /(^|\.)youtube\.com$/.test(new URL(url).hostname)

/** Reads a page up to its </head>; YouTube pages are huge and keep some tags in the body. */
async function readPage(url: string) {
  const youTube = isYouTube(url)
  return safeGet(url, {
    accept: "text/html,application/xhtml+xml;q=0.9,image/*;q=0.8",
    maxBytes: (youTube ? 1536 : 1024) * 1024,
    stopAt: youTube ? undefined : /<\/head>/i,
    partial: true,
  })
}

/** YouTube's oEmbed; it refuses (401) videos whose owner turned off embedding elsewhere. */
async function youtube(url: string, id: string): Promise<Embed | null> {
  try {
    const oembed = await safeGet(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`,
      { accept: "application/json", maxBytes: 64 * 1024 }
    )
    return youtubeEmbed(url, id, JSON.parse(oembed.body.toString("utf8")))
  } catch {
    // Not embeddable: show it from the page's tags (they sit ~800 KB in), playing on YouTube.
    const page = await readPage(`https://www.youtube.com/watch?v=${id}`)
    return parseMeta(decodeHtml(page.body, page.contentType), url, page.url, { anywhere: true })
  }
}

async function unfurl(url: string): Promise<Embed | null> {
  try {
    const video = youtubeId(url)
    if (video) return await youtube(url, video)
    const page = await readPage(url)
    if (/^image\/(png|jpe?g|gif|webp|avif)/.test(page.contentType)) return imageEmbed(url)
    if (!page.contentType.includes("html")) return null
    return parseMeta(decodeHtml(page.body, page.contentType), url, page.url, { anywhere: isYouTube(page.url) })
  } catch {
    return null
  }
}

/** A link preview for one URL, fetched server-side (see lib/unfurl/fetch for the safety rules). */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")
  if (!url || url.length > 2048) return Response.json({ error: "bad_request" }, { status: 400 })

  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getClaims()
  const userId = auth?.claims.sub
  if (!userId) return Response.json({ error: "unauthenticated" }, { status: 401 })

  let hit = cache.get(url)
  if (!hit || Date.now() - hit.at > (hit.embed ? TTL_MS : EMPTY_TTL_MS)) {
    if (!allow(`unfurl:${userId}`, 60, 60_000)) return Response.json({ error: "rate_limited" }, { status: 429 })
    hit = { at: Date.now(), embed: await unfurl(url) }
    if (cache.size > 1000) cache.clear()
    cache.set(url, hit)
  }
  const maxAge = (hit.embed ? TTL_MS : EMPTY_TTL_MS) / 1000
  return Response.json({ embed: hit.embed }, { headers: { "Cache-Control": `private, max-age=${maxAge}` } })
}
