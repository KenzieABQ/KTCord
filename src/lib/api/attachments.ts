import { getSupabase } from "@/lib/supabase/client"

import { ApiError } from "./errors"

/** Stored on messages.attachments. `path` is inside the private "attachments" bucket. */
export type Attachment = {
  path: string
  name: string
  size: number
  mime: string
  kind: "image" | "video" | "file"
  width?: number
  height?: number
  spoiler?: boolean
}

export const MAX_ATTACHMENTS = 10
export const MAX_FILE_BYTES = 25 * 1024 * 1024
const BUCKET = "attachments"
const URL_TTL_SECONDS = 60 * 60

export function attachmentKind(mime: string): Attachment["kind"] {
  // SVGs can carry scripts; treat them as plain files rather than inline images.
  if (mime.startsWith("image/") && mime !== "image/svg+xml") return "image"
  if (mime.startsWith("video/")) return "video"
  return "file"
}

/** Storage-safe file name: keeps letters, digits, dots, dashes and underscores. */
export function safeFileName(name: string): string {
  const cleaned = name.normalize("NFKD").replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").slice(-120)
  return cleaned || "file"
}

export function attachmentPath(channelId: string, messageId: string, index: number, name: string) {
  return `${channelId}/${messageId}/${index}-${safeFileName(name)}`
}

export async function imageSize(file: File): Promise<{ width: number; height: number } | undefined> {
  if (attachmentKind(file.type) !== "image") return undefined
  try {
    const bitmap = await createImageBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  } catch {
    return undefined
  }
}

/** Uploads through a signed upload URL so progress can be reported. */
export async function uploadAttachment(path: string, file: File, onProgress?: (fraction: number) => void) {
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true })
  if (error || !data) {
    throw new ApiError(
      /row-level security|not authorized|unauthorized/i.test(error?.message ?? "")
        ? "You don't have permission to upload files here."
        : "Couldn't start the upload. Try again.",
      undefined,
      error
    )
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", data.signedUrl)
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream")
    xhr.setRequestHeader("x-upsert", "true")
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(xhr.status === 413 ? "That file is too large (max 25 MB)." : "Upload failed. Try again."))
    xhr.onerror = () => reject(new ApiError("Upload failed. Check your connection."))
    xhr.send(file)
  })
  onProgress?.(1)
}

// ---------------------------------------------------------------------------
// Signed URLs, batched: every attachment rendered in the same tick shares one request.
// ---------------------------------------------------------------------------

type Cached = { url: string; expires: number }
const cache = new Map<string, Cached>()
let pending: { path: string; resolve: (url: string) => void; reject: (e: unknown) => void }[] = []
let timer: ReturnType<typeof setTimeout> | null = null

async function flush() {
  const batch = pending
  pending = []
  timer = null
  const paths = [...new Set(batch.map((p) => p.path))]
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrls(paths, URL_TTL_SECONDS)
  const byPath = new Map<string, string>()
  for (const item of data ?? []) if (item.path && item.signedUrl) byPath.set(item.path, item.signedUrl)
  const expires = Date.now() + (URL_TTL_SECONDS - 60) * 1000
  for (const { path, resolve, reject } of batch) {
    const url = byPath.get(path)
    if (url) {
      cache.set(path, { url, expires })
      resolve(url)
    } else {
      reject(error ?? new ApiError("That file is no longer available."))
    }
  }
}

export function signedAttachmentUrl(path: string): Promise<string> {
  const hit = cache.get(path)
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.url)
  return new Promise((resolve, reject) => {
    pending.push({ path, resolve, reject })
    timer ??= setTimeout(() => void flush(), 10)
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
