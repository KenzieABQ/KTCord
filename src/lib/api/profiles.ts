import { getSupabase } from "@/lib/supabase/client"
import type { Tables, TablesUpdate } from "@/lib/supabase/database.types"

import { ApiError, toApiError, unwrap } from "./errors"

export type Profile = Tables<"profiles">
export type ProfileUpdate = Pick<
  TablesUpdate<"profiles">,
  | "display_name"
  | "username"
  | "avatar_url"
  | "banner_color"
  | "banner_url"
  | "theme_primary"
  | "theme_accent"
  | "cosmetics"
  | "pronouns"
  | "bio"
  | "custom_status_text"
  | "custom_status_emoji"
  | "custom_status_expires_at"
  | "onboarded_at"
>

export async function getProfile(id: string): Promise<Profile> {
  return unwrap(
    await getSupabase().from("profiles").select("*").eq("id", id).single()
  )
}

export async function updateProfile(
  id: string,
  patch: ProfileUpdate
): Promise<Profile> {
  const result = await getSupabase()
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single()
  if (result.error?.code === "23505") {
    throw new ApiError("That username is taken.", "23505", result.error)
  }
  return unwrap(result)
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await getSupabase().rpc("username_available", {
    p_username: username,
  })
  if (error) throw toApiError(error)
  return Boolean(data)
}
