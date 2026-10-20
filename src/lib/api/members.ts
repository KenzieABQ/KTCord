import { getSupabase } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/database.types"

import { unwrap } from "./errors"

export type Role = Tables<"roles">

export type MemberProfile = Pick<
  Tables<"profiles">,
  | "id"
  | "username"
  | "display_name"
  | "avatar_url"
  | "banner_color"
  | "bio"
  | "custom_status_text"
  | "custom_status_emoji"
  | "custom_status_expires_at"
  | "created_at"
>

export type Member = Pick<
  Tables<"server_members">,
  "id" | "server_id" | "user_id" | "nickname" | "joined_at" | "timeout_until"
> & {
  profile: MemberProfile
  role_ids: string[]
}

const MEMBER_SELECT =
  "id, server_id, user_id, nickname, joined_at, timeout_until, " +
  "profile:profiles!inner(id, username, display_name, avatar_url, banner_color, bio, custom_status_text, custom_status_emoji, custom_status_expires_at, created_at), " +
  "member_roles(role_id)"

type MemberRow = Omit<Member, "role_ids"> & { member_roles: { role_id: string }[] }

export async function listMembers(serverId: string): Promise<Member[]> {
  const rows = unwrap(
    await getSupabase()
      .from("server_members")
      .select(MEMBER_SELECT)
      .eq("server_id", serverId)
      .order("joined_at", { ascending: true })
      .returns<MemberRow[]>()
  )
  return rows.map(({ member_roles, ...member }) => ({
    ...member,
    role_ids: member_roles.map((r) => r.role_id),
  }))
}

export async function listRoles(serverId: string): Promise<Role[]> {
  return unwrap(
    await getSupabase()
      .from("roles")
      .select("*")
      .eq("server_id", serverId)
      .order("position", { ascending: false })
  )
}
