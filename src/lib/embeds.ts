import { parseMarkdown, type MdNode } from "@/lib/markdown/parse"

/** A link preview, as returned by /api/unfurl. */
export type Embed = {
  url: string
  kind: "link" | "image" | "video"
  siteName: string | null
  /** The creator, like a YouTube channel. */
  author: string | null
  title: string | null
  description: string | null
  image: { url: string; width: number | null; height: number | null } | null
  /** Show the image large under the text (summary_large_image), rather than as a thumbnail. */
  largeImage: boolean
  color: string | null
  youtubeId: string | null
  /** The video can play inside the chat (its owner allows embedding). */
  playsInline?: boolean
}

export const MAX_EMBEDS = 5

/** The YouTube video id in a watch, short, embed or youtu.be link. */
export function youtubeId(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "")
  let id: string | null = null
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0]
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v")
    else id = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? null
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null
}

function collect(nodes: MdNode[], out: string[]) {
  for (const node of nodes) {
    if (node.type === "link") {
      if (!node.suppressEmbed && !out.includes(node.url)) out.push(node.url)
    } else if (node.type === "list") {
      for (const item of node.items) collect(item, out)
    } else if ("children" in node && node.type !== "spoiler") {
      collect(node.children, out)
    }
  }
}

/**
 * The links in a message that get previews: not <suppressed>, not inside spoilers, not
 * links to this app (invites and such), at most MAX_EMBEDS.
 */
export function embedUrls(content: string, ownOrigin?: string): string[] {
  const urls: string[] = []
  collect(parseMarkdown(content), urls)
  return urls
    .filter((u) => {
      try {
        return !ownOrigin || new URL(u).origin !== ownOrigin
      } catch {
        return false
      }
    })
    .slice(0, MAX_EMBEDS)
}

/** Embed images load through our proxy so viewers' IPs aren't shared with other sites. */
export function proxiedImage(url: string) {
  return `/api/unfurl/image?url=${encodeURIComponent(url)}`
}
