import type { Embed } from "@/lib/embeds"
import { youtubeId } from "@/lib/embeds"

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", copy: "©", reg: "®", trade: "™", middot: "·", bull: "•",
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole
    }
    return NAMED[code.toLowerCase()] ?? whole
  })
}

function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ""
  }
  return out
}

function clean(value: string | undefined, max: number): string | null {
  if (!value) return null
  const text = decodeEntities(value).replace(/\s+/g, " ").trim()
  if (!text) return null
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

function absoluteUrl(value: string | undefined, base: string): string | null {
  if (!value) return null
  try {
    const url = new URL(decodeEntities(value.trim()), base)
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null
  } catch {
    return null
  }
}

function dimension(value: string | undefined): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 && n < 20000 ? n : null
}

/**
 * Reads a page's Open Graph / Twitter card / <title> tags into an embed for `pageUrl`;
 * relative image paths resolve against `baseUrl` (where redirects ended). Returns null when
 * there's nothing worth showing.
 */
export function parseMeta(html: string, pageUrl: string, baseUrl = pageUrl): Embed | null {
  const headEnd = html.search(/<\/head>/i)
  const head = headEnd > 0 ? html.slice(0, headEnd) : html
  const meta: Record<string, string> = {}
  for (const m of head.matchAll(/<meta\b([^>]*)>/gi)) {
    const attrs = attributes(m[1])
    const key = (attrs.property ?? attrs.name ?? attrs.itemprop)?.toLowerCase()
    if (key && attrs.content !== undefined && !(key in meta)) meta[key] = attrs.content
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]

  const title = clean(meta["og:title"] ?? meta["twitter:title"] ?? titleTag, 256)
  const description = clean(meta["og:description"] ?? meta["twitter:description"] ?? meta.description, 350)
  const siteName = clean(meta["og:site_name"] ?? meta["application-name"], 100)
  const imageUrl = absoluteUrl(
    meta["og:image:secure_url"] ?? meta["og:image"] ?? meta["og:image:url"] ?? meta["twitter:image"] ?? meta["twitter:image:src"],
    baseUrl
  )
  const color = /^#(?:[0-9a-f]{3}){1,2}$/i.test(meta["theme-color"] ?? "") ? meta["theme-color"] : null
  const video = youtubeId(pageUrl)

  if (!title && !description && !imageUrl) return null
  return {
    url: pageUrl,
    kind: video ? "video" : "link",
    siteName: video ? "YouTube" : siteName,
    author: null,
    title,
    description: video ? null : description,
    image: imageUrl
      ? { url: imageUrl, width: dimension(meta["og:image:width"]), height: dimension(meta["og:image:height"]) }
      : null,
    largeImage: Boolean(video) || meta["twitter:card"] === "summary_large_image",
    color: video ? "#ff0000" : color,
    youtubeId: video,
  }
}

/** An embed for a link that is itself an image. */
export function imageEmbed(url: string): Embed {
  return {
    url,
    kind: "image",
    siteName: null,
    author: null,
    title: null,
    description: null,
    image: { url, width: null, height: null },
    largeImage: true,
    color: null,
    youtubeId: null,
  }
}

/** A YouTube embed from its oEmbed answer (YouTube pages are too heavy to read for tags). */
export function youtubeEmbed(url: string, id: string, oembed: { title?: unknown; author_name?: unknown }): Embed {
  return {
    url,
    kind: "video",
    siteName: "YouTube",
    author: clean(typeof oembed.author_name === "string" ? oembed.author_name : undefined, 100),
    title: clean(typeof oembed.title === "string" ? oembed.title : undefined, 256),
    description: null,
    image: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, width: 480, height: 360 },
    largeImage: true,
    color: "#ff0000",
    youtubeId: id,
  }
}
