import type { Embed } from "@/lib/embeds"

/** A link preview from /api/unfurl, or null when the page has nothing to show. */
export async function fetchEmbed(url: string): Promise<Embed | null> {
  const res = await fetch(`/api/unfurl?url=${encodeURIComponent(url)}`)
  if (!res.ok) return null
  const body = (await res.json()) as { embed: Embed | null }
  return body.embed
}
