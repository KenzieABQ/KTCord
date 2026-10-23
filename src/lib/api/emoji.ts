import { getSupabase } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/database.types"

import { ApiError, toApiError, unwrap } from "./errors"

export type ServerEmoji = Tables<"server_emojis">

/** Discord's limit for emoji images. */
export const MAX_EMOJI_BYTES = 256 * 1024

/** Custom emoji from every server the user is in (RLS limits it to those). */
export async function listMyEmojis(): Promise<ServerEmoji[]> {
  return unwrap(await getSupabase().from("server_emojis").select("*").order("created_at"))
}

/** A valid emoji name from a file name: letters, digits and underscores, 2–32 long. */
export function emojiNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "")
  return (base.length >= 2 ? base : `emoji_${base}`).slice(0, 32)
}

/** Adds an emoji: the database row first (it checks permission and the limit), then the image. */
export async function createServerEmoji(serverId: string, name: string, file: File): Promise<string> {
  if (!["image/png", "image/gif", "image/webp", "image/jpeg"].includes(file.type)) {
    throw new ApiError("Emoji must be PNG, GIF, WebP or JPEG images.")
  }
  if (file.size > MAX_EMOJI_BYTES) throw new ApiError("Emoji images must be 256 KB or smaller.")

  const supabase = getSupabase()
  const { data: id, error } = await supabase.rpc("create_server_emoji", {
    p_server: serverId,
    p_name: name,
    p_animated: file.type === "image/gif",
  })
  if (error) throw toApiError(error)

  const upload = await supabase.storage.from("emojis").upload(id, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  })
  if (upload.error) {
    await supabase.from("server_emojis").delete().eq("id", id)
    throw new ApiError("Couldn't upload the emoji image. Try again.", undefined, upload.error)
  }
  return id
}

export async function renameServerEmoji(id: string, name: string) {
  const { error } = await getSupabase().rpc("rename_server_emoji", { p_emoji: id, p_name: name })
  if (error) throw toApiError(error)
}

export async function deleteServerEmoji(id: string) {
  const supabase = getSupabase()
  await supabase.storage.from("emojis").remove([id])
  unwrap(await supabase.from("server_emojis").delete().eq("id", id).select("id"))
}
