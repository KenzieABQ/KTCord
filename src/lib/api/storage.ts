import { getSupabase } from "@/lib/supabase/client"

import { ApiError } from "./errors"

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
}

/** Uploads to a public bucket under `{folder}/{timestamp}.{ext}` and returns the public URL. */
async function uploadPublicImage(
  bucket: "avatars" | "server-icons",
  folder: string,
  file: Blob
): Promise<string> {
  const ext = EXT_BY_TYPE[file.type]
  if (!ext) throw new ApiError("That image type isn't supported.")

  const path = `${folder}/${Date.now()}.${ext}`
  const storage = getSupabase().storage.from(bucket)
  const { error } = await storage.upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  })
  if (error) {
    throw new ApiError(
      error.message.includes("exceeded")
        ? "That image is too large (max 5 MB)."
        : "Couldn't upload the image. Try again.",
      undefined,
      error
    )
  }
  return storage.getPublicUrl(path).data.publicUrl
}

export function uploadAvatar(userId: string, file: Blob) {
  return uploadPublicImage("avatars", userId, file)
}

export function uploadServerIcon(serverId: string, file: Blob) {
  return uploadPublicImage("server-icons", serverId, file)
}
