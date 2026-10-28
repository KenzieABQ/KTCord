"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, ExternalLinkIcon, FileIcon, XIcon } from "@/components/icons"
import { useEffect, useState } from "react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { formatBytes, signedAttachmentUrl, type Attachment } from "@/lib/api/attachments"
import { useUploadStore } from "@/lib/stores/upload-store"
import { cn } from "@/lib/utils"

/** A displayable URL: the local preview while sending, else a signed URL (batched, cached ~1h). */
export function useAttachmentUrl(path: string) {
  const local = useUploadStore((s) => s.localUrls[path])
  const query = useQuery({
    queryKey: ["attachment-url", path],
    queryFn: () => signedAttachmentUrl(path),
    enabled: !local,
    staleTime: 50 * 60_000,
    retry: 1,
  })
  return local ?? query.data
}

function UploadProgress({ path }: { path: string }) {
  const progress = useUploadStore((s) => s.progress[path])
  if (progress === undefined || progress >= 1) return null
  return (
    <div className="absolute inset-x-2 bottom-2 h-1.5 overflow-hidden rounded-full bg-black/50" aria-label="Uploading">
      <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
    </div>
  )
}

function SpoilerCover({ onReveal }: { onReveal: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onReveal()
      }}
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-2xl"
    >
      <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-bold tracking-wide text-white uppercase">
        Spoiler
      </span>
    </button>
  )
}

function ImageTile({
  attachment,
  single,
  onOpen,
}: {
  attachment: Attachment
  single: boolean
  onOpen: () => void
}) {
  const url = useAttachmentUrl(attachment.path)
  const [revealed, setRevealed] = useState(!attachment.spoiler)
  const ratio = attachment.width && attachment.height ? attachment.width / attachment.height : 4 / 3
  // Fit inside 400×300 for a single image, like Discord; grids use square tiles.
  const width = single ? Math.min(400, 300 * ratio, attachment.width ?? 400) : undefined

  return (
    <div
      className={cn("relative overflow-hidden rounded-lg bg-floating/40", !single && "aspect-square")}
      style={single ? { width, aspectRatio: ratio } : undefined}
    >
      {!revealed && <SpoilerCover onReveal={() => setRevealed(true)} />}
      {url ? (
        <button type="button" onClick={onOpen} className="block size-full" aria-label={`Open ${attachment.name}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
          <img src={url} alt={attachment.name} loading="lazy" className="size-full object-cover" />
        </button>
      ) : (
        <div className="size-full animate-pulse bg-item-selected/40" />
      )}
      <UploadProgress path={attachment.path} />
    </div>
  )
}

function VideoTile({ attachment }: { attachment: Attachment }) {
  const url = useAttachmentUrl(attachment.path)
  const [revealed, setRevealed] = useState(!attachment.spoiler)
  return (
    <div className="relative max-w-[400px] overflow-hidden rounded-lg bg-black">
      {!revealed && <SpoilerCover onReveal={() => setRevealed(true)} />}
      {url ? (
        <video src={url} controls preload="metadata" className="max-h-[300px] w-full" />
      ) : (
        <div className="aspect-video animate-pulse bg-item-selected/40" />
      )}
      <UploadProgress path={attachment.path} />
    </div>
  )
}

function FileTile({ attachment }: { attachment: Attachment }) {
  const url = useAttachmentUrl(attachment.path)
  return (
    <div className="relative flex w-full max-w-[400px] items-center gap-3 rounded-lg border border-border bg-sidebar p-3">
      <FileIcon className="size-8 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" download={attachment.name} className="block truncate text-link hover:underline">
            {attachment.name}
          </a>
        ) : (
          <span className="block truncate text-foreground">{attachment.name}</span>
        )}
        <span className="text-xs text-muted-foreground">{formatBytes(attachment.size)}</span>
      </div>
      {url && (
        <a href={url} download={attachment.name} aria-label={`Download ${attachment.name}`} className="text-interactive hover:text-interactive-hover">
          <DownloadIcon className="size-5" />
        </a>
      )}
      <UploadProgress path={attachment.path} />
    </div>
  )
}

function Lightbox({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: Attachment[]
  index: number | null
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const current = index === null ? null : images[index]
  const url = useAttachmentUrl(current?.path ?? "")

  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && index < images.length - 1) onIndex(index + 1)
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [index, images.length, onIndex])

  return (
    <Dialog open={index !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-dvh max-h-dvh w-screen max-w-none items-center justify-center rounded-none border-0 bg-black/90 p-4 shadow-none ring-0 sm:max-w-none"
        onClick={onClose}
      >
        <DialogTitle className="sr-only">{current?.name ?? "Image"}</DialogTitle>
        {current && url && (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
          <img
            src={url}
            alt={current.name}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85dvh] max-w-[92vw] object-contain"
          />
        )}
        <div className="absolute top-4 right-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open original" className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
              <ExternalLinkIcon className="size-4" />
            </a>
          )}
          <button type="button" aria-label="Close" onClick={onClose} className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
            <XIcon className="size-5" />
          </button>
        </div>
        {index !== null && index > 0 && (
          <button
            type="button"
            aria-label="Previous image"
            onClick={(e) => {
              e.stopPropagation()
              onIndex(index - 1)
            }}
            className="absolute left-4 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeftIcon />
          </button>
        )}
        {index !== null && index < images.length - 1 && (
          <button
            type="button"
            aria-label="Next image"
            onClick={(e) => {
              e.stopPropagation()
              onIndex(index + 1)
            }}
            className="absolute right-4 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRightIcon />
          </button>
        )}
        {current && (
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 truncate text-sm text-white/80">
            {current.name}
            {images.length > 1 && index !== null ? ` · ${index + 1} of ${images.length}` : ""}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Images (grid + lightbox), videos and file cards under a message. */
export function MessageAttachments({ attachments }: { attachments: Attachment[] }) {
  const [lightbox, setLightbox] = useState<number | null>(null)
  if (attachments.length === 0) return null
  const images = attachments.filter((a) => a.kind === "image")
  const others = attachments.filter((a) => a.kind !== "image")

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      {images.length > 0 && (
        <div
          className={cn(
            "grid max-w-[520px] gap-1",
            images.length === 1 ? "grid-cols-1" : images.length === 2 || images.length === 4 ? "grid-cols-2" : "grid-cols-3"
          )}
        >
          {images.map((a, i) => (
            <ImageTile key={a.path} attachment={a} single={images.length === 1} onOpen={() => setLightbox(i)} />
          ))}
        </div>
      )}
      {others.map((a) =>
        a.kind === "video" ? <VideoTile key={a.path} attachment={a} /> : <FileTile key={a.path} attachment={a} />
      )}
      <Lightbox images={images} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />
    </div>
  )
}
