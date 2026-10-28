"use client"

import { useQuery } from "@tanstack/react-query"
import { PlayIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { fetchEmbed } from "@/lib/api/unfurl"
import { embedUrls, proxiedImage, type Embed } from "@/lib/embeds"
import { usePrefsStore } from "@/lib/stores/prefs-store"
import { cn } from "@/lib/utils"

const MAX_IMAGE_WIDTH = 400
const MAX_IMAGE_HEIGHT = 300

/** Fits an image into the embed's box, keeping its shape, so space is reserved before it loads. */
function fitted(image: NonNullable<Embed["image"]>) {
  if (!image.width || !image.height) return undefined
  const scale = Math.min(1, MAX_IMAGE_WIDTH / image.width, MAX_IMAGE_HEIGHT / image.height)
  return { width: Math.round(image.width * scale), height: Math.round(image.height * scale) }
}

function EmbedImage({ image, href, className }: { image: NonNullable<Embed["image"]>; href: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  const size = fitted(image)
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={cn("block overflow-hidden rounded", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- proxied third-party images */}
      <img
        src={proxiedImage(image.url)}
        alt=""
        loading="lazy"
        width={size?.width}
        height={size?.height}
        onError={() => setFailed(true)}
        className="max-h-[300px] max-w-full object-contain"
      />
    </a>
  )
}

/**
 * YouTube: the thumbnail with a play button; the player loads only when clicked. Videos
 * whose owner turned off embedding open on YouTube instead.
 */
function YouTubePlayer({ embed }: { embed: Embed }) {
  const [playing, setPlaying] = useState(false)
  const thumbnail = embed.image && (
    // eslint-disable-next-line @next/next/no-img-element -- proxied third-party images
    <img src={proxiedImage(embed.image.url)} alt="" loading="lazy" className="size-full object-cover" />
  )
  const playIcon = (
    <span className="absolute inset-0 m-auto flex size-12 items-center justify-center rounded-full bg-black/70 text-white transition-transform group-hover/play:scale-110">
      <PlayIcon className="size-6 fill-current" />
    </span>
  )
  if (!embed.playsInline) {
    return (
      <a
        href={embed.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        aria-label={`Watch ${embed.title ?? "video"} on YouTube`}
        className="group/play relative block aspect-video w-full overflow-hidden rounded bg-black"
      >
        {thumbnail}
        {playIcon}
      </a>
    )
  }
  if (playing) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${embed.youtubeId}?autoplay=1`}
        title={embed.title ?? "YouTube video"}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="aspect-video w-full rounded"
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play ${embed.title ?? "video"}`}
      className="group/play relative block aspect-video w-full overflow-hidden rounded bg-black"
    >
      {thumbnail}
      {playIcon}
    </button>
  )
}

function EmbedCard({ embed }: { embed: Embed }) {
  if (embed.kind === "image" && embed.image) {
    return <EmbedImage image={embed.image} href={embed.url} className="mt-1 w-fit" />
  }
  const thumbnail = embed.image && !embed.largeImage
  return (
    // Not an <article>: the feed's arrow-key navigation moves between those (messages).
    <div
      className="mt-1 grid max-w-[432px] gap-2 rounded border-l-4 bg-card p-3 pr-4"
      style={{ borderLeftColor: embed.color ?? "var(--border)" }}
    >
      <div className={cn("flex min-w-0 gap-4", thumbnail && "items-start")}>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {embed.siteName && <p className="text-xs text-muted-foreground">{embed.siteName}</p>}
          {embed.author && <p className="text-sm font-semibold text-header">{embed.author}</p>}
          {embed.title && (
            <a
              href={embed.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-semibold break-words text-link hover:underline"
            >
              {embed.title}
            </a>
          )}
          {embed.description && (
            <p className="line-clamp-4 text-sm break-words whitespace-pre-line text-foreground/90">{embed.description}</p>
          )}
        </div>
        {thumbnail && <EmbedImage image={embed.image!} href={embed.url} className="size-20 shrink-0 [&_img]:size-20 [&_img]:object-cover" />}
      </div>
      {embed.kind === "video" && embed.youtubeId ? (
        <YouTubePlayer embed={embed} />
      ) : (
        embed.image && embed.largeImage && <EmbedImage image={embed.image} href={embed.url} />
      )}
    </div>
  )
}

function LinkEmbed({ url }: { url: string }) {
  const { data: embed } = useQuery({
    queryKey: ["embed", url],
    queryFn: () => fetchEmbed(url),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  })
  return embed ? <EmbedCard embed={embed} /> : null
}

/** Previews for the links in a message (Settings → Appearance can turn them off). */
export function LinkEmbeds({ content }: { content: string }) {
  const enabled = usePrefsStore((s) => s.linkPreviews)
  const urls = useMemo(() => (enabled ? embedUrls(content, window.location.origin) : []), [content, enabled])
  if (urls.length === 0) return null
  return (
    <div className="flex flex-col">
      {urls.map((url) => (
        <LinkEmbed key={url} url={url} />
      ))}
    </div>
  )
}
